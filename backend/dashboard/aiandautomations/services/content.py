from ..models import AISettings
from .providers import get_provider
from .usage import record_usage


PROMPTS = {
    'Product Description': 'Write a compelling product description with 3–5 bullet points.',
    'TikTok Caption': 'Write a short TikTok caption (under 150 characters) followed by 5 hashtags.',
    'WhatsApp Broadcast': 'Write a short WhatsApp promo message (under 300 characters).',
    'Social Media Post': 'Write an Instagram/Facebook caption with 1 line of suggested image text.',
    'SEO Meta Description': 'Write a 155-character SEO meta description.',
    'Product Title': 'Write a TikTok-optimized product title (under 70 characters).',
}


def generate(product_context: dict, content_type: str, tone: str, language: str, length: str) -> dict:
    provider = get_provider()
    instruction = PROMPTS.get(content_type, PROMPTS['Product Description'])
    system = (
        f"You write e-commerce marketing copy. Tone: {tone}. "
        f"Language: {language}. Length: {length}. "
        f"Output ONLY the copy — no preamble, no quotes, no explanations."
    )
    user = f"{instruction}\n\nProduct:\n{product_context}"

    resp = provider.chat(
        messages=[{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
        temperature=0.7,
        max_tokens=700,
    )
    record_usage('content', resp['tokens_in'], resp['tokens_out'])
    return {
        'body': resp['content'].strip(),
        'tokens': resp['tokens_in'] + resp['tokens_out'],
    }