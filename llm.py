from __future__ import annotations
from openai import OpenAI
from config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, SYSTEM_PROMPT


class LLMClient:
    def __init__(self, system_prompt: str | None = None):
        self.client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
        self._system_prompt = system_prompt or SYSTEM_PROMPT
        self._reset_history()

    def _reset_history(self):
        self.history = [{"role": "system", "content": self._system_prompt}]

    def chat(self, user_message: str) -> str:
        self.history.append({"role": "user", "content": user_message})
        response = self.client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=self.history,
        )
        reply = response.choices[0].message.content.strip()
        self.history.append({"role": "assistant", "content": reply})
        return reply

    def reset(self):
        self._reset_history()
