from __future__ import annotations

import time
from collections import deque

import numpy as np

import voice_agent_pb2 as pb2
import voice_agent_pb2_grpc as pb2_grpc


class STTServicer(pb2_grpc.STTServiceServicer):
    """Streaming Whisper STT with rolling 1–2s window and stability filter.

    Only reprocesses the last 2 seconds of audio on each chunk — GPU cost
    stays flat regardless of call duration.

    Stability filter: emits is_final=True only after the transcript suffix
    has been unchanged for 300ms, preventing unstable partials like
    "book a flight to pari" from triggering the LLM.
    """

    WINDOW_SAMPLES = 32000   # 2s at 16kHz
    STABLE_SECS    = 0.30    # 300ms stability before committing

    def __init__(self, stt) -> None:
        self.stt = stt

    async def StreamTranscribe(self, request_iterator, context):
        audio_buffer: deque[float] = deque(maxlen=self.WINDOW_SAMPLES)
        cached_prefix = ""
        last_suffix = ""
        stability_since: float | None = None

        async for chunk in request_iterator:
            if context.cancelled():
                return

            # Extend ring buffer (float32 PCM16-normalised values)
            pcm = np.frombuffer(chunk.data, dtype=np.int16).astype(np.float32) / 32768.0
            audio_buffer.extend(pcm.tolist())

            window = np.array(list(audio_buffer), dtype=np.float32)
            raw_text = self.stt.transcribe(window).strip()

            new_suffix = raw_text[len(cached_prefix):]

            if new_suffix != last_suffix:
                # Transcript changed — reset stability timer, emit partial
                last_suffix = new_suffix
                stability_since = time.monotonic()
                yield pb2.TranscriptChunk(
                    text=raw_text,
                    is_final=False,
                    timestamp_ms=int(time.time() * 1000),
                )
            else:
                # Transcript stable — check if past threshold
                if stability_since is not None:
                    elapsed = time.monotonic() - stability_since
                    if elapsed >= self.STABLE_SECS:
                        cached_prefix = raw_text
                        last_suffix = ""
                        stability_since = None
                        yield pb2.TranscriptChunk(
                            text=raw_text,
                            is_final=True,
                            timestamp_ms=int(time.time() * 1000),
                        )
