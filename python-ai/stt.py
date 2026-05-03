from __future__ import annotations

import numpy as np
import torch
from transformers import pipeline

WHISPER_MODEL = "openai/whisper-base"
RECORDING_SAMPLE_RATE = 16000


def _best_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


class SpeechToText:
    def __init__(self) -> None:
        device = _best_device()
        print(f"  STT: loading {WHISPER_MODEL} on {device}")
        self.pipe = pipeline(
            "automatic-speech-recognition",
            model=WHISPER_MODEL,
            device=device,
        )
        self.sample_rate = RECORDING_SAMPLE_RATE

    def transcribe(self, audio: np.ndarray) -> str:
        result = self.pipe({"array": audio.astype(np.float32), "sampling_rate": self.sample_rate})
        return result["text"].strip()
