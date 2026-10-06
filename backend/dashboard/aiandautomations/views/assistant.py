import json
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..models import Conversation, Message
from ..permissions import IsAdminUser
from ..serializers import ConversationSerializer, MessageSerializer
from ..services.assistant import run_turn, _history
from ..services.providers import get_provider
from ..services.usage import record_usage


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def conversations_view(request):
    if request.method == 'GET':
        qs = Conversation.objects.filter(user=request.user)
        return Response(ConversationSerializer(qs, many=True).data)
    conv = Conversation.objects.create(user=request.user, title='New chat')
    return Response(ConversationSerializer(conv).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def messages_view(request, conv_id):
    conv = Conversation.objects.filter(pk=conv_id, user=request.user).first()
    if not conv:
        return Response({'detail': 'Not found'}, status=404)

    if request.method == 'GET':
        return Response(MessageSerializer(conv.messages.all(), many=True).data)

    text = (request.data or {}).get('content', '').strip()
    if not text:
        return Response({'detail': 'content required'}, status=400)

    msg = run_turn(conv, text, user=request.user)
    return Response(MessageSerializer(msg).data)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def stream_view(request, conv_id):
    """SSE stream of the assistant reply."""
    conv = Conversation.objects.filter(pk=conv_id, user=request.user).first()
    if not conv:
        return Response({'detail': 'Not found'}, status=404)

    text = (request.data or {}).get('content', '').strip()
    if not text:
        return Response({'detail': 'content required'}, status=400)

    # Persist user message first
    Message.objects.create(conversation=conv, role='user', content=text)
    if conv.title in ('', 'New chat'):
        conv.title = text[:80]
        conv.save(update_fields=['title'])

    def event_stream():
        provider = get_provider()
        messages = _history(conv)
        full = []
        tokens_in = tokens_out = 0
        try:
            for chunk in provider.stream(messages):
                if chunk.get('done'):
                    tokens_in = chunk.get('tokens_in', 0)
                    tokens_out = chunk.get('tokens_out', 0)
                    break
                piece = chunk.get('text', '')
                if piece:
                    full.append(piece)
                    yield f'data: {json.dumps({"type": "chunk", "text": piece})}\n\n'

            # Persist final message
            final = Message.objects.create(
                conversation=conv, role='assistant', content=''.join(full),
                tokens_in=tokens_in, tokens_out=tokens_out,
            )
            record_usage('assistant', tokens_in, tokens_out)
            payload = MessageSerializer(final).data
            yield f'data: {json.dumps({"type": "done", "message": payload}, default=str)}\n\n'
        except Exception as e:
            yield f'data: {json.dumps({"type": "error", "error": str(e)})}\n\n'

    resp = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    resp['Cache-Control'] = 'no-cache'
    resp['X-Accel-Buffering'] = 'no'
    return resp