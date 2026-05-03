from __future__ import annotations

FILLER_TEXTS = [
    "Mm-hmm.",
    "Hmm...",
    "Let me think about that.",
    "Sure!",
    "One moment.",
    "Right.",
    "Got it.",
]


class FillerCache:
    """Pre-synthesizes short acknowledgment clips at startup.

    These are served via the GetFiller RPC with zero inference latency,
    bridging the silent gap between transcript commit and the first LLM token.
    Each clip is synthesized without conversation context so startup is fast.
    """

    def __init__(self, tts) -> None:
        self.clips: dict[str, bytes] = {}
        print("  Fillers: pre-synthesizing acknowledgment clips...")
        for text in FILLER_TEXTS:
            self.clips[text] = tts.synthesize(text)
        print(f"  Fillers: {len(self.clips)} clips ready.")

    def get(self, key: str) -> bytes | None:
        return self.clips.get(key)

    def keys(self) -> list[str]:
        return list(self.clips.keys())
