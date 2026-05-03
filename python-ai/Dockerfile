FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY python-ai/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY proto/voice_agent.proto ./
COPY python-ai/*.py ./

RUN python -m grpc_tools.protoc -I. \
    --python_out=. \
    --grpc_python_out=. \
    voice_agent.proto || true

# Models are downloaded at first startup and cached in the hf_cache volume.
# Set HF_HOME so the volume mount lands in the right place.
ENV HF_HOME=/root/.cache/huggingface

EXPOSE 50051

CMD ["python", "grpc_server.py"]
