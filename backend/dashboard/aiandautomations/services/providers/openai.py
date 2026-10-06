from .base import BaseProvider
from openai import OpenAI


class OpenAIProvider(BaseProvider):
    def __init__(self, api_key, model='gpt-4o-mini', base_url=''):
        self.client = OpenAI(api_key=api_key, base_url=base_url or None)
        self.model = model

    def chat(self, messages, tools=None, temperature=0.4, max_tokens=1024):
        kwargs = dict(model=self.model, messages=messages, temperature=temperature, max_tokens=max_tokens)
        if tools:
            kwargs['tools'] = tools
        r = self.client.chat.completions.create(**kwargs)
        choice = r.choices[0].message
        import json
        tool_calls = []
        for tc in (choice.tool_calls or []):
            try:
                args = json.loads(tc.function.arguments or '{}')
            except Exception:
                args = {}
            tool_calls.append({'id': tc.id, 'name': tc.function.name, 'arguments': args})
        return {
            'content': choice.content or '',
            'tool_calls': tool_calls,
            'tokens_in': r.usage.prompt_tokens if r.usage else 0,
            'tokens_out': r.usage.completion_tokens if r.usage else 0,
        }

    def stream(self, messages, temperature=0.4, max_tokens=1024):
        s = self.client.chat.completions.create(
            model=self.model, messages=messages,
            temperature=temperature, max_tokens=max_tokens, stream=True,
        )
        full = []
        for chunk in s:
            d = chunk.choices[0].delta
            if d and d.content:
                full.append(d.content)
                yield {'text': d.content}
        text = ''.join(full)
        yield {'done': True, 'tokens_in': 0, 'tokens_out': len(text) // 4}