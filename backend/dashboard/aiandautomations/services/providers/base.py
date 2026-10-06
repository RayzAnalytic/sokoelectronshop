from abc import ABC, abstractmethod


class BaseProvider(ABC):
    """Every provider implements these two methods."""

    @abstractmethod
    def chat(self, messages, tools=None, temperature=0.4, max_tokens=1024):
        """Return {'content': str, 'tool_calls': list, 'tokens_in': int, 'tokens_out': int}."""
        raise NotImplementedError

    @abstractmethod
    def stream(self, messages, temperature=0.4, max_tokens=1024):
        """Yield chunks of text. Final yield is a dict {'done': True, 'tokens_in': ..., 'tokens_out': ...}."""
        raise NotImplementedError