import json
from openai import OpenAI

from .base import BaseProvider


GROQ_BASE_URL = 'https://api.groq.com/openai/v1'


class GroqProvider(BaseProvider):
    """
    Groq exposes an OpenAI-compatible API, so we use the OpenAI SDK
    pointed at Groq's base URL.
    """

    def __init__(self, api_key: str, model: str = 'llama-3.3-70b-versatile', base_url: str = ''):
        self.client = OpenAI(api_key=api_key, base_url=base_url or GROQ_BASE_URL)
        self.model = model

    def chat(self, messages, tools=None, temperature=0.4, max_tokens=1024):
        kwargs = dict(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if tools:
            kwargs['tools'] = tools
            kwargs['tool_choice'] = 'auto'

        resp = self.client.chat.completions.create(**kwargs)
        choice = resp.choices[0].message

        tool_calls = []
        if choice.tool_calls:
            for tc in choice.tool_calls:
                try:
                    args = json.loads(tc.function.arguments or '{}')
                except Exception:
                    args = {}
                tool_calls.append({'id': tc.id, 'name': tc.function.name, 'arguments': args})

        usage = getattr(resp, 'usage', None)
        return {
            'content': choice.content or '',
            'tool_calls': tool_calls,
            'tokens_in': getattr(usage, 'prompt_tokens', 0) if usage else 0,
            'tokens_out': getattr(usage, 'completion_tokens', 0) if usage else 0,
        }

    def stream(self, messages, temperature=0.4, max_tokens=1024):
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        full = []
        for chunk in stream:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                full.append(delta.content)
                yield {'text': delta.content}
        text = ''.join(full)
        # Groq doesn't always emit usage in stream mode — approximate
        approx_in = sum(len(str(m.get('content', ''))) for m in messages) // 4
        approx_out = len(text) // 4
        yield {'done': True, 'tokens_in': approx_in, 'tokens_out': approx_out}