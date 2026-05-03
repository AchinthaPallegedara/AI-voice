from __future__ import annotations

import asyncio
import logging
import os

import grpc

import voice_agent_pb2_grpc as pb2_grpc
from fillers import FillerCache
from stt import SpeechToText
from stt_service import STTServicer
from tts import TextToSpeech
from tts_service import TTSServicer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

GRPC_PORT = int(os.getenv("GRPC_PORT", "50051"))


async def serve() -> None:
    log.info("Loading models (first run ~1 min)...")

    loop = asyncio.get_event_loop()
    stt = await loop.run_in_executor(None, SpeechToText)
    tts = await loop.run_in_executor(None, TextToSpeech)
    fillers = await loop.run_in_executor(None, FillerCache, tts)

    server = grpc.aio.server()
    pb2_grpc.add_STTServiceServicer_to_server(STTServicer(stt), server)
    pb2_grpc.add_TTSServiceServicer_to_server(TTSServicer(tts, fillers), server)

    listen_addr = f"[::]:{GRPC_PORT}"
    server.add_insecure_port(listen_addr)

    log.info(f"gRPC server listening on {listen_addr}")
    await server.start()
    await server.wait_for_termination()


if __name__ == "__main__":
    asyncio.run(serve())
