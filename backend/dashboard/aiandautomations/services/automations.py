"""Event dispatcher — every signal in the project eventually calls this."""
import logging
from django.utils import timezone

from ..models import Automation, AutomationRun, AutomationStatus
from ..models import AuditLog

log = logging.getLogger(__name__)


def dispatch(event_name: str, payload: dict, user=None):
    """Called from signals. Finds matching automations and runs them."""
    matches = Automation.objects.filter(trigger_event=event_name, status=AutomationStatus.ACTIVE)
    for auto in matches:
        _run(auto, event_name, payload)


def _run(automation: Automation, event_name: str, payload: dict):
    success = True
    error = ''
    try:
        # 1. Conditions
        if not _passes_conditions(automation, payload):
            return
        # 2. Action — for now we just log. Hook WhatsApp/Email here later.
        _execute_action(automation, payload)
    except Exception as e:
        success = False
        error = str(e)
        log.exception('Automation %s failed', automation.pk)

    AutomationRun.objects.create(
        automation=automation,
        event_name=event_name,
        payload=payload,
        success=success,
        error=error,
    )
    automation.runs += 1
    if success:
        automation.successes += 1
    automation.last_run_at = timezone.now()
    automation.save(update_fields=['runs', 'successes', 'last_run_at'])


def _passes_conditions(auto: Automation, payload: dict) -> bool:
    """Simple condition language. Add more as needed."""
    cond = auto.conditions or {}
    min_total = cond.get('min_total')
    if min_total and payload.get('total', 0) < min_total:
        return False
    channel = cond.get('channel')
    if channel and payload.get('channel') != channel:
        return False
    return True


def _execute_action(auto: Automation, payload: dict):
    """
    Hook point. Today: audit log. Tomorrow: send WhatsApp, email, update status, etc.
    """
    AuditLog.objects.create(
        action=f'automation.{auto.action_type}',
        resource=f'automation:{auto.pk}',
        detail={'payload': payload, 'template': auto.template},
    )