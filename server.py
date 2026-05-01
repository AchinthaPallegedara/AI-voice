import asyncio
import base64
import io
import json
from pathlib import Path

import soundfile as sf
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from llm import LLMClient
from stt import SpeechToText
from tts import TextToSpeech

SETTINGS_FILE = Path("settings.json")
DEFAULT_SETTINGS = {
    "ai_name": "Aria",
    "system_prompt": (
        "You are a helpful and friendly voice assistant. "
        "Keep responses concise and conversational — avoid markdown, "
        "bullet points, code blocks, or any special formatting."
    ),
}


def load_settings() -> dict:
    if SETTINGS_FILE.exists():
        try:
            return {**DEFAULT_SETTINGS, **json.loads(SETTINGS_FILE.read_text())}
        except Exception:
            pass
    return DEFAULT_SETTINGS.copy()


def save_settings(data: dict):
    SETTINGS_FILE.write_text(json.dumps({**DEFAULT_SETTINGS, **data}, indent=2))


app = FastAPI()

print("Loading models (this takes ~1 min on first run)...")
stt = SpeechToText()
tts = TextToSpeech()   # loaded once at startup — CSM is too heavy to reload per call
print("All models ready. Server starting...")

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def index():
    return FileResponse("static/index.html")


@app.get("/settings-page")
async def settings_page():
    return FileResponse("static/settings.html")


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
    data = await request.json()
    text = data.get("text", "Hello! How can I help you today?")
    audio = await tts.synthesize_async(text)
    return Response(content=audio, media_type="audio/wav")


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    settings = load_settings()
    llm = LLMClient(system_prompt=settings["system_prompt"])

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
                    text = await asyncio.to_thread(stt.transcribe, audio_buf)
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
                try:
                    audio_out = await tts.synthesize_async(reply)
                    await send({"type": "audio", "data": base64.b64encode(audio_out).decode()})
                except Exception as e:
                    await send({"type": "error", "text": f"TTS error: {e}"})

                await send({"type": "status", "status": "idle"})

            elif msg["type"] == "reset":
                llm.reset()
                await send({"type": "status", "status": "idle"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WS error: {e}")
