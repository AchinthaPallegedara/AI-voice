from __future__ import annotations

import asyncio
import io

import numpy as np
import soundfile as sf
import torch
from transformers import AutoProcessor, CsmForConditionalGeneration

from config import CSM_MODEL_ID, CSM_SAMPLE_RATE


def _best_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


class TextToSpeech:
    def __init__(self):
        self.device = _best_device()
        print(f"  TTS: loading {CSM_MODEL_ID} on {self.device} (first load takes ~1 min)...")
        self.processor = AutoProcessor.from_pretrained(CSM_MODEL_ID)
        self.model = CsmForConditionalGeneration.from_pretrained(
            CSM_MODEL_ID,
            torch_dtype=torch.bfloat16 if self.device == "cuda" else (torch.float16 if self.device == "mps" else torch.float32),
        ).to(self.device)
        self.model.eval()
        print("  TTS: ready.")

    def synthesize(self, text: str, speaker_id: int = 0) -> bytes:
        conversation = [{
            "role": str(speaker_id),
            "content": [{"type": "text", "text": text}],
        }]
        inputs = self.processor.apply_chat_template(
            conversation,
            tokenize=True,
            return_dict=True,
        ).to(self.device)

        with torch.no_grad():
            audio_tensors = self.model.generate(**inputs, output_audio=True)

        audio_np = audio_tensors[0].cpu().numpy().astype(np.float32)

        buf = io.BytesIO()
        sf.write(buf, audio_np, CSM_SAMPLE_RATE, format="WAV", subtype="PCM_16")
        return buf.getvalue()

    async def synthesize_async(self, text: str, speaker_id: int = 0) -> bytes:
        return await asyncio.to_thread(self.synthesize, text, speaker_id)
