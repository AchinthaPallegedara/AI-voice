from __future__ import annotations

import asyncio
import io

import numpy as np
import soundfile as sf
import torch
from transformers import AutoProcessor, CsmForConditionalGeneration

CSM_MODEL_ID = "sesame/csm-1b"
CSM_SAMPLE_RATE = 24000
SPEAKER_ID_ASSISTANT = 0


def _best_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


class TextToSpeech:
    def __init__(self) -> None:
        self.device = _best_device()
        print(f"  TTS: loading {CSM_MODEL_ID} on {self.device}...")
        self.processor = AutoProcessor.from_pretrained(CSM_MODEL_ID)
        self.model = CsmForConditionalGeneration.from_pretrained(
            CSM_MODEL_ID,
            torch_dtype=torch.float16 if self.device != "cpu" else torch.float32,
        ).to(self.device)
        self.model.eval()
        if self.device != "cpu":
            try:
                self.model = torch.compile(self.model, mode="reduce-overhead")
                print("  TTS: torch.compile applied.")
            except Exception:
                pass
        print("  TTS: ready.")

    def synthesize(self, text: str, speaker_id: int = SPEAKER_ID_ASSISTANT) -> bytes:
        conversation = [{
            "role": str(speaker_id),
            "content": [{"type": "text", "text": text}],
        }]
        return self._run_generation(conversation)

    def synthesize_with_conversation(self, conversation: list[dict]) -> bytes:
        """Generate speech conditioned on prior turns (text + optional audio tensors).

        conversation is a list of CSM-format dicts already assembled by the caller,
        where each entry may include {"type": "audio", "audio": tensor} for conditioning.
        """
        return self._run_generation(conversation)

    def _run_generation(self, conversation: list[dict]) -> bytes:
        inputs = self.processor.apply_chat_template(
            conversation,
            tokenize=True,
            return_dict=True,
        ).to(self.device)

        generator = torch.Generator(device=self.device if self.device != "mps" else "cpu")
        generator.manual_seed(42)

        with torch.no_grad():
            audio_tensors = self.model.generate(
                **inputs,
                output_audio=True,
                do_sample=True,
                temperature=0.8,
                generator=generator,
            )

        audio_np = audio_tensors[0].cpu().to(torch.float32).numpy()
        # Return raw PCM16 bytes (no WAV header) for gRPC transport.
        # Callers that need WAV (e.g. legacy server.py) should use synthesize_wav().
        pcm16 = (audio_np * 32767).clip(-32768, 32767).astype("int16")
        return pcm16.tobytes()

    def synthesize_wav(self, text: str, speaker_id: int = SPEAKER_ID_ASSISTANT) -> bytes:
        """Return WAV bytes (for legacy HTTP endpoints)."""
        pcm16 = np.frombuffer(self.synthesize(text, speaker_id), dtype=np.int16)
        audio_f32 = pcm16.astype(np.float32) / 32768.0
        buf = io.BytesIO()
        sf.write(buf, audio_f32, CSM_SAMPLE_RATE, format="WAV", subtype="PCM_16")
        return buf.getvalue()

    async def synthesize_async(self, text: str, speaker_id: int = SPEAKER_ID_ASSISTANT) -> bytes:
        return await asyncio.to_thread(self.synthesize, text, speaker_id)
