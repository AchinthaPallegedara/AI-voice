import modal

app = modal.App("voice-agent")

secrets = [modal.Secret.from_name("voice-agent-secrets")]


def _download_models():
    """Baked into the image so cold start only loads from disk, not network."""
    import os
    from transformers import AutoProcessor, CsmForConditionalGeneration, pipeline

    token = os.environ.get("HF_TOKEN")
    print("Downloading Whisper...")
    pipeline("automatic-speech-recognition", model="openai/whisper-base", token=token)
    print("Downloading CSM-1B...")
    AutoProcessor.from_pretrained("sesame/csm-1b", token=token)
    CsmForConditionalGeneration.from_pretrained("sesame/csm-1b", token=token)
    print("Models cached in image.")


image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("gcc", "git")
    .pip_install_from_requirements("requirements.txt")
    .run_function(_download_models, secrets=secrets)
    # Source files — build frontend first: cd frontend && npm run build
    .add_local_dir("frontend/dist", "/app/frontend/dist")
    .add_local_file("server.py",    "/app/server.py")
    .add_local_file("config.py",    "/app/config.py")
    .add_local_file("stt.py",       "/app/stt.py")
    .add_local_file("tts.py",       "/app/tts.py")
    .add_local_file("llm.py",       "/app/llm.py")
    .add_local_file("settings.json","/app/settings.json")
)


@app.function(
    image=image,
    gpu="A10G",
    scaledown_window=300,   # stay warm 5 min after last call
    min_containers=0,        # scale to zero → $0 when idle
    secrets=secrets,
    timeout=600,
)
@modal.asgi_app()
def serve():
    import sys
    sys.path.insert(0, "/app")
    from server import app as fastapi_app
    return fastapi_app
