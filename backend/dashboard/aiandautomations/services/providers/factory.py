from .groq import GroqProvider
from ..crypto import decrypt


def get_provider(settings_obj=None):
    """
    Returns a configured provider instance based on AISettings.
    Currently only Groq is fully implemented; the pattern is here for others.
    """
    from ...models import AISettings
    s = settings_obj or AISettings.get_solo()
    api_key = decrypt(s.api_key_encrypted) if s.api_key_encrypted else ''

    if s.provider == 'groq':
        return GroqProvider(api_key=api_key, model=s.model, base_url=s.base_url)
    # Extend here for openai / gemini / openrouter / custom
    raise NotImplementedError(f'Provider "{s.provider}" is not implemented yet.')