import os
from dotenv import load_dotenv

load_dotenv()

# DeepSeek LLM
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

# CSM TTS
CSM_MODEL_ID = "sesame/csm-1b"
CSM_SAMPLE_RATE = 24000  # CSM requires 24kHz output
SPEAKER_ID_ASSISTANT = 0
SPEAKER_ID_USER = 1

# Whisper STT
WHISPER_MODEL = "openai/whisper-base"
RECORDING_SAMPLE_RATE = 16000  # Whisper works at 16kHz

# Audio recording
CHANNELS = 1
SILENCE_THRESHOLD = 0.015   # RMS energy threshold to detect silence
SILENCE_DURATION = 1.5      # Seconds of silence before stopping recording
MAX_RECORDING_DURATION = 30 # Hard cap in seconds

# Conversation context kept for CSM (number of full turns = user + assistant pairs)
CONTEXT_TURNS = 3

SYSTEM_PROMPT = (
    "You are a helpful and friendly voice assistant. "
    "Keep responses concise and conversational — avoid markdown, "
    "bullet points, code blocks, or any special formatting."
)
