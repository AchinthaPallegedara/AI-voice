FROM python:3.11-slim

# System deps (no PortAudio needed — server uses no audio hardware)
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Node for building the React frontend
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python deps ──────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── React frontend build ─────────────────────────────────────────
COPY frontend/package*.json frontend/
RUN cd frontend && npm install --legacy-peer-deps

COPY frontend/ frontend/
RUN cd frontend && npm run build

# ── Backend ──────────────────────────────────────────────────────
COPY server.py config.py stt.py tts.py llm.py settings.json ./

# Pre-download models at build time so pod starts fast.
# Requires HF_TOKEN build-arg if sesame/csm-1b is gated on your account.
# Pass: docker build --build-arg HF_TOKEN=hf_xxx ...
ARG HF_TOKEN=""
ENV HF_TOKEN=${HF_TOKEN}
ENV HF_HOME=/app/.cache/huggingface

RUN python - <<'EOF'
import os, torch
from transformers import AutoProcessor, CsmForConditionalGeneration, pipeline

token = os.environ.get("HF_TOKEN") or None

print("Downloading Whisper…")
pipeline("automatic-speech-recognition", model="openai/whisper-base", token=token)

print("Downloading CSM-1B…")
AutoProcessor.from_pretrained("sesame/csm-1b", token=token)
CsmForConditionalGeneration.from_pretrained("sesame/csm-1b", token=token)

print("Models cached.")
EOF

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
