"""
Orchestrates a chat turn:
  1. Build messages list from conversation history.
  2. Call the provider. If it returns tool_calls, run them and re-prompt.
  3. Mask PII, persist the assistant message, record usage.
"""
import json
from django.utils import timezone

from ..models import Conversation, Message, AISettings
from ..tools import TOOLS_SCHEMA, run_tool
from .masking import mask_rows, mask_text
from .providers import get_provider
from .usage import record_usage


SYSTEM_PROMPT = (
    "You are the store assistant for an e-commerce admin dashboard in Kenya. "
    "You are READ-ONLY: you can query data but never change orders, products, or settings. "
    "When the user asks about sales, orders, customers, or stock, call the appropriate tool. "
    "Always show money in KES. Keep answers tight (2–4 sentences) with concrete numbers. "
    "Never reveal customer emails or phone numbers — they are masked as [email] / [phone]. "
    "If you don't have a tool for something, say so plainly."
)


def _history(conversation: Conversation):
    msgs = [{'role': 'system', 'content': SYSTEM_PROMPT}]
    for m in conversation.messages.all()[:40]:
        msgs.append({'role': m.role, 'content': m.content})
    return msgs


def _mask_enabled():
    return AISettings.get_solo().masking


def _finalize_message(conversation, content, tokens_in, tokens_out, chart=None, table=None, link=None):
    if _mask_enabled():
        content = mask_text(content)
        table = mask_rows(table)
    msg = Message.objects.create(
        conversation=conversation,
        role='assistant',
        content=content,
        chart_json=chart,
        table_json=table,
        link_json=link,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
    )
    conversation.updated_at = timezone.now()
    conversation.save(update_fields=['updated_at'])
    record_usage('assistant', tokens_in, tokens_out)
    return msg


def run_turn(conversation: Conversation, user_text: str, user=None):
    """Non-streaming variant — good for tests and for now."""
    Message.objects.create(conversation=conversation, role='user', content=user_text.strip())

    if conversation.title in ('', 'New chat'):
        conversation.title = user_text.strip()[:80]
        conversation.save(update_fields=['title'])

    provider = get_provider()
    messages = _history(conversation)

    response = provider.chat(messages, tools=TOOLS_SCHEMA)
    total_in = response['tokens_in']
    total_out = response['tokens_out']

    # Tool call loop (max 4 hops to avoid runaway)
    for _ in range(4):
        if not response['tool_calls']:
            break
        for call in response['tool_calls']:
            result = run_tool(call['name'], call['arguments'])
            messages.append({
                'role': 'assistant',
                'content': response['content'] or '',
                'tool_calls': [{
                    'id': call['id'],
                    'type': 'function',
                    'function': {'name': call['name'], 'arguments': json.dumps(call['arguments'])},
                }],
            })
            messages.append({
                'role': 'tool',
                'tool_call_id': call['id'],
                'content': json.dumps(result, default=str)[:6000],
            })
        response = provider.chat(messages, tools=TOOLS_SCHEMA)
        total_in += response['tokens_in']
        total_out += response['tokens_out']

    return _finalize_message(
        conversation,
        content=response['content'] or 'I could not produce an answer just now.',
        tokens_in=total_in,
        tokens_out=total_out,
    )