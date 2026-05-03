from __future__ import annotations

import asyncio
import re

import numpy as np
import torch

import voice_agent_pb2 as pb2
import voice_agent_pb2_grpc as pb2_grpc

CONTEXT_TURNS = 3
SPEAKER_ID_ASSISTANT = 0
SPEAKER_ID_USER = 1

# Max 2 concurrent synthesis jobs.
# A 3rd caller blocks here, which propagates backpressure to the Go gRPC send,
# which in turn pauses the LLM token consumer — no explicit flow control needed.
_SEMAPHORE = asyncio.Semaphore(2)

_FLUSH_RE = re.compile(r'[.,!?…]')


def _should_flush(text: str) -> bool:
    return bool(_FLUSH_RE.search(text)) or len(text.split()) >= 8


class TTSServicer(pb2_grpc.TTSServiceServicer):
    """Incremental CSM-1B TTS with conversation audio conditioning.

    Each StreamSynthesize call:
    - Accepts text tokens as they arrive from the Go LLM client
    - Buffers until a natural flush point (punctuation or ~8 words)
    - Synthesizes that segment using CSM audio context from the last 3 turns
    - Yields PCM16 audio chunks immediately (24kHz)

    GetFiller returns pre-cached audio with zero inference latency.
    """

    def __init__(self, tts, filler_cache) -> None:
        self.tts = tts
        self.fillers = filler_cache

    async def StreamSynthesize(self, request_iterator, context):
        async with _SEMAPHORE:
            token_buffer = ""
            conv_context: list[pb2.ConversationTurn] = []

            async for chunk in request_iterator:
                if context.cancelled():
                    return

                # Capture context from first chunk (same for all chunks in stream)
                if not conv_context and chunk.context:
                    conv_context = list(chunk.context)

                token_buffer += chunk.text

                flush = _should_flush(token_buffer) or chunk.end_of_stream
                if flush and token_buffer.strip():
                    audio_bytes = await asyncio.to_thread(
                        self._synthesize_with_context,
                        token_buffer.strip(),
                        conv_context,
                    )
                    yield pb2.AudioChunk(data=audio_bytes)
                    token_buffer = ""

    def _synthesize_with_context(
        self, text: str, context: list[pb2.ConversationTurn]
    ) -> bytes:
        conversation = []

        for turn in context[-CONTEXT_TURNS:]:
            entry: dict = {
                "role": turn.role,
                "content": [{"type": "text", "text": turn.text}],
            }
            if turn.audio:
                # Reconstruct float32 tensor from PCM16 bytes at 24kHz
                pcm = np.frombuffer(turn.audio, dtype=np.int16).astype(np.float32) / 32768.0
                audio_tensor = torch.from_numpy(pcm).to(self.tts.device)
                entry["content"].insert(0, {"type": "audio", "audio": audio_tensor})
            conversation.append(entry)

        conversation.append({
            "role": str(SPEAKER_ID_ASSISTANT),
            "content": [{"type": "text", "text": text}],
        })

        return self.tts.synthesize_with_conversation(conversation)

    async def GetFiller(self, request, context):
        audio = self.fillers.get(request.key)
        if audio is None:
            # Key not found — return empty chunk rather than error
            return pb2.AudioChunk(data=b"")
        return pb2.AudioChunk(data=audio)
