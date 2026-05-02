"""
Voice Agent
===========
Pipeline:
  Microphone → Whisper STT → DeepSeek LLM → CSM TTS → Speaker
"""

import io
import sys
import numpy as np
import sounddevice as sd
import soundfile as sf

from config import (
    RECORDING_SAMPLE_RATE,
    CSM_SAMPLE_RATE,
    CHANNELS,
    SILENCE_THRESHOLD,
    SILENCE_DURATION,
    MAX_RECORDING_DURATION,
    SPEAKER_ID_ASSISTANT,
)
from stt import SpeechToText
from tts import TextToSpeech
from llm import LLMClient


class VoiceAgent:
    def __init__(self):
        print("Initialising voice agent components...")
        self.stt = SpeechToText()
        self.tts = TextToSpeech()
        self.llm = LLMClient()
        print("\nAll components ready.\n")

    # ------------------------------------------------------------------
    # Audio I/O
    # ------------------------------------------------------------------

    def record_until_silence(self) -> np.ndarray:
        """Block until the user speaks and then falls silent; return audio array."""
        chunk_s = 0.1  # 100 ms polling window
        chunk_n = int(RECORDING_SAMPLE_RATE * chunk_s)
        max_chunks = int(MAX_RECORDING_DURATION / chunk_s)
        silence_limit = int(SILENCE_DURATION / chunk_s)

        chunks: list[np.ndarray] = []
        silence_count = 0
        speech_started = False

        print("Listening… (speak now)")

        for _ in range(max_chunks):
            chunk = sd.rec(
                chunk_n,
                samplerate=RECORDING_SAMPLE_RATE,
                channels=CHANNELS,
                dtype="float32",
            )
            sd.wait()
            chunk = chunk.flatten()
            rms = float(np.sqrt(np.mean(chunk ** 2)))

            if rms > SILENCE_THRESHOLD:
                if not speech_started:
                    print("Recording…")
                    speech_started = True
                silence_count = 0
                chunks.append(chunk)
            elif speech_started:
                chunks.append(chunk)
                silence_count += 1
                if silence_count >= silence_limit:
                    break

        if not chunks:
            return np.array([], dtype=np.float32)

        return np.concatenate(chunks)

    def play(self, audio_bytes: bytes):
        audio_np, _ = sf.read(io.BytesIO(audio_bytes), dtype="float32")
        sd.play(audio_np, samplerate=CSM_SAMPLE_RATE)
        sd.wait()

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    def run(self):
        print("=" * 50)
        print(" Voice Agent  —  say something to begin")
        print(" Ctrl-C to quit | say 'reset' to clear history")
        print("=" * 50 + "\n")

        try:
            while True:
                # 1. Record
                user_audio_16k = self.record_until_silence()
                if user_audio_16k.size < RECORDING_SAMPLE_RATE * 0.4:
                    print("(no speech detected, try again)\n")
                    continue

                # 2. Transcribe
                print("Transcribing…")
                user_text = self.stt.transcribe(user_audio_16k)
                if not user_text:
                    print("(could not understand, try again)\n")
                    continue
                print(f"You : {user_text}")

                if user_text.lower().strip() in {"reset", "reset."}:
                    self.llm.reset()
                    print("(conversation reset)\n")
                    continue

                # 3. LLM response
                print("Thinking…")
                reply = self.llm.chat(user_text)
                print(f"Bot : {reply}")

                # 4. Synthesise and play
                print("Speaking…")
                reply_audio = self.tts.synthesize(reply, speaker_id=SPEAKER_ID_ASSISTANT)
                self.play(reply_audio)
                print()

        except KeyboardInterrupt:
            print("\nGoodbye!")
            sys.exit(0)


if __name__ == "__main__":
    agent = VoiceAgent()
    agent.run()
