import torch
import numpy as np
from transformers import pipeline

from config import WHISPER_MODEL, RECORDING_SAMPLE_RATE


def _best_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


class SpeechToText:
    def __init__(self):
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
