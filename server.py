import asyncio
import base64
import io
import json
import re
from contextlib import asynccontextmanager
from pathlib import Path

import soundfile as sf
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from llm import LLMClient
from stt import SpeechToText
from tts import TextToSpeech

SETTINGS_FILE = Path(__file__).parent / "settings.json"
DEFAULT_SETTINGS = {
    "ai_name": "Aria",
    "system_prompt": (
        "You are a helpful and friendly voice assistant. "
        "Keep responses concise and conversational — avoid markdown, "
        "bullet points, code blocks, or any special formatting."
    ),
}


_SENT_RE = re.compile(r'(?<=[.!?…])\s+')


def _split_sentences(text: str) -> list[str]:
    parts = _SENT_RE.split(text.strip())
    return [p.strip() for p in parts if p.strip()] or [text.strip()]


def load_settings() -> dict:
    if SETTINGS_FILE.exists():
        try:
            return {**DEFAULT_SETTINGS, **json.loads(SETTINGS_FILE.read_text())}
        except Exception:
            pass
    return DEFAULT_SETTINGS.copy()


def save_settings(data: dict):
    SETTINGS_FILE.write_text(json.dumps({**DEFAULT_SETTINGS, **data}, indent=2))


# Models loaded in background so /api/health is reachable immediately on cold start
_stt: SpeechToText | None = None
_tts: TextToSpeech | None = None
_models_ready = False


async def _load_models():
    global _stt, _tts, _models_ready
    print("Loading models in background (this takes ~1 min on first run)...")
    loop = asyncio.get_event_loop()
    _stt = await loop.run_in_executor(None, SpeechToText)
    _tts = await loop.run_in_executor(None, TextToSpeech)
    _models_ready = True
    print("All models ready.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(_load_models())
    yield


app = FastAPI(lifespan=lifespan)

DIST = Path(__file__).parent / "frontend/dist"

app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/")
async def index():
    return FileResponse(DIST / "index.html")


@app.get("/api/health")
async def health():
    return JSONResponse({"ready": _models_ready})


@app.get("/api/settings")
async def get_settings():
    return JSONResponse(load_settings())


@app.post("/api/settings")
async def update_settings(request: Request):
    data = await request.json()
    save_settings(data)
    return JSONResponse({"ok": True})


@app.post("/api/preview")
async def preview_voice(request: Request):
    if not _models_ready:
        return JSONResponse({"error": "Models still loading"}, status_code=503)
    data = await request.json()
    text = data.get("text", "Hello! How can I help you today?")
    audio = await _tts.synthesize_async(text)
    return Response(content=audio, media_type="audio/wav")


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    return FileResponse(DIST / "index.html")


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()

    if not _models_ready:
        await ws.send_text(json.dumps({"type": "error", "text": "Models still loading — please wait"}))
        await ws.close()
        return

    # Read connection-time context from URL query params
    params      = ws.query_params
    character   = params.get("character", "").strip()
    usercontext = {}
    try:
        usercontext = json.loads(params.get("usercontext", "{}"))
    except Exception:
        pass

    settings = load_settings()
    system_prompt = settings["system_prompt"]

    # Prepend timezone context if provided
    timezone = usercontext.get("timezone", "").strip()
    if timezone:
        system_prompt = f"The user's timezone is {timezone}.\n\n{system_prompt}"

    llm = LLMClient(system_prompt=system_prompt)

    async def send(obj: dict):
        await ws.send_text(json.dumps(obj))

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)

            if msg["type"] == "audio":
                try:
                    audio_bytes = base64.b64decode(msg["data"])
                    audio_buf, _ = sf.read(io.BytesIO(audio_bytes), dtype="float32")
                    if audio_buf.ndim > 1:
                        audio_buf = audio_buf.mean(axis=1)
                except Exception as e:
                    await send({"type": "error", "text": f"Audio error: {e}"})
                    await send({"type": "status", "status": "idle"})
                    continue

                await send({"type": "status", "status": "transcribing"})
                try:
                    text = await asyncio.to_thread(_stt.transcribe, audio_buf)
                except Exception as e:
                    await send({"type": "error", "text": f"STT error: {e}"})
                    await send({"type": "status", "status": "idle"})
                    continue

                if not text:
                    await send({"type": "status", "status": "idle"})
                    continue

                await send({"type": "transcription", "text": text})

                await send({"type": "status", "status": "thinking"})
                try:
                    reply = await asyncio.to_thread(llm.chat, text)
                except Exception as e:
                    await send({"type": "error", "text": f"LLM error: {e}"})
                    await send({"type": "status", "status": "idle"})
                    continue

                await send({"type": "reply", "text": reply})

                await send({"type": "status", "status": "speaking"})
                sentences = _split_sentences(reply)
                tts_ok = True
                for sentence in sentences:
                    try:
                        audio_out = await _tts.synthesize_async(sentence)
                        await send({
                            "type": "audio_chunk",
                            "data": base64.b64encode(audio_out).decode(),
                        })
                    except Exception as e:
                        await send({"type": "error", "text": f"TTS error: {e}"})
                        tts_ok = False
                        break
                if tts_ok:
                    await send({"type": "audio_done"})

                await send({"type": "status", "status": "idle"})

            elif msg["type"] == "ping":
                await send({
                    "type": "ping_response",
                    "session_id": msg.get("session_id"),
                    "request_id": msg.get("request_id"),
                    "content": "ping",
                })

            elif msg["type"] == "call_disconnect":
                await send({
                    "type": "call_disconnect_response",
                    "session_id": msg.get("session_id"),
                    "request_id": msg.get("request_id"),
                    "call_id": msg.get("call_id"),
                })
                await ws.close()
                return

            elif msg["type"] == "reset":
                llm.reset()
                await send({"type": "status", "status": "idle"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WS error: {e}")
