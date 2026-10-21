from django.utils import timezone

from .models import Campaign, CampaignDispatch


def resolve_audience_size(campaign):
    source = campaign.audience_source
    ref_id = campaign.audience_ref_id

    if not ref_id:
        return 0

    try:
        if source == Campaign.AudienceSource.WHATSAPP_SEGMENT:
            from dashboard.whatsapp.models import WhatsAppSegment

            obj = WhatsAppSegment.objects.filter(pk=ref_id).first()
            return getattr(obj, 'contact_count_cached', 0) or 0

        if source == Campaign.AudienceSource.NEWSLETTER_LIST:
            from dashboard.newsletter.models import SubscriberList

            obj = SubscriberList.objects.filter(pk=ref_id).first()
            return getattr(obj, 'subscriber_count_cached', 0) or 0

        if source == Campaign.AudienceSource.NEWSLETTER_SEGMENT:
            from dashboard.newsletter.models import Segment

            obj = Segment.objects.filter(pk=ref_id).first()
            return getattr(obj, 'subscriber_count_cached', 0) or 0
    except Exception:
        return 0

    return 0


def _dispatch_whatsapp(campaign):
    from dashboard.whatsapp.models import WhatsAppBroadcast

    content = (campaign.content or {}).get('whatsapp', {}) or {}
    return WhatsAppBroadcast.objects.create(
        campaign_name=campaign.name,
        template_id=content.get('template_id'),
        audience=content.get('audience', 'ALL'),
        segment_id=campaign.audience_ref_id or None,
        scheduled_at=campaign.scheduled_at,
    )


def _dispatch_email(campaign):
    from dashboard.newsletter.models import Campaign as EmailCampaign

    content = (campaign.content or {}).get('email', {}) or {}
    return EmailCampaign.objects.create(
        name=campaign.name,
        subject=content.get('subject', ''),
        body=content.get('body', ''),
        audience_type=content.get('audience_type', 'ALL'),
        audience_id=str(content.get('audience_id', '')),
        scheduled_at=campaign.scheduled_at,
    )


def _dispatch_social(campaign):
    from dashboard.social.models import SocialPost

    content = (campaign.content or {}).get('social', {}) or {}
    return SocialPost.objects.create(
        caption=content.get('caption', ''),
        product_tag=content.get('product_tag', ''),
        scheduled_for=campaign.scheduled_at,
    )


DISPATCHERS = {
    CampaignDispatch.Channel.WHATSAPP: _dispatch_whatsapp,
    CampaignDispatch.Channel.EMAIL: _dispatch_email,
    CampaignDispatch.Channel.SOCIAL: _dispatch_social,
}


def dispatch_campaign(campaign):
    if campaign.audience_source != Campaign.AudienceSource.ALL:
        campaign.audience_size_cached = resolve_audience_size(campaign)

    results = []
    for channel in campaign.channels or []:
        dispatch, _ = CampaignDispatch.objects.get_or_create(
            campaign=campaign,
            channel=channel,
        )
        try:
            dispatcher = DISPATCHERS.get(channel)
            if dispatcher is None:
                dispatch.status = CampaignDispatch.Status.FAILED
                dispatch.error = f'Unknown channel: {channel}'
                dispatch.save()
                results.append(dispatch)
                continue

            external = dispatcher(campaign)
            dispatch.external_ref_id = str(external.pk)
            dispatch.status = CampaignDispatch.Status.SENT
            dispatch.result = {'created_id': external.pk, 'channel': channel}
            dispatch.sent_at = timezone.now()
            dispatch.error = ''
            dispatch.save()
        except Exception as exc:
            dispatch.status = CampaignDispatch.Status.FAILED
            dispatch.error = str(exc)
            dispatch.save()
        results.append(dispatch)

    failed = [d for d in results if d.status == CampaignDispatch.Status.FAILED]
    succeeded = [d for d in results if d.status == CampaignDispatch.Status.SENT]

    if results and not succeeded:
        campaign.status = Campaign.Status.FAILED
    elif campaign.scheduled_at and not succeeded:
        campaign.status = Campaign.Status.SCHEDULED
    else:
        campaign.status = Campaign.Status.SENDING

    campaign.save(update_fields=['status', 'audience_size_cached', 'updated_at'])
    return results


def aggregate_analytics(campaign):
    totals = {
        'sent': 0,
        'delivered': 0,
        'opened': 0,
        'clicked': 0,
        'converted': 0,
        'failed': 0,
        'revenue': 0,
    }
    per_channel = []

    for dispatch in campaign.dispatches.all():
        block = {
            'channel': dispatch.channel,
            'status': dispatch.status,
            'external_ref_id': dispatch.external_ref_id,
            **{k: 0 for k in totals},
        }

        if dispatch.channel == CampaignDispatch.Channel.WHATSAPP and dispatch.external_ref_id:
            try:
                from dashboard.whatsapp.models import WhatsAppBroadcast

                b = WhatsAppBroadcast.objects.get(pk=dispatch.external_ref_id)
                block['sent'] = getattr(b, 'sent_count', 0) or 0
                block['delivered'] = getattr(b, 'delivered_count', 0) or 0
                block['opened'] = getattr(b, 'read_count', 0) or 0
                block['clicked'] = getattr(b, 'replied_count', 0) or 0
                block['failed'] = getattr(b, 'failed_count', 0) or 0
            except Exception:
                pass

        elif dispatch.channel == CampaignDispatch.Channel.EMAIL and dispatch.external_ref_id:
            try:
                from dashboard.newsletter.models import Campaign as EmailCampaign

                c = EmailCampaign.objects.get(pk=dispatch.external_ref_id)
                sent = getattr(c, 'sent_count', 0) or 0
                failed = getattr(c, 'failed_count', 0) or 0
                open_rate = getattr(c, 'open_rate', 0) or 0
                click_rate = getattr(c, 'click_rate', 0) or 0
                block['sent'] = sent
                block['failed'] = failed
                block['delivered'] = max(sent - failed, 0)
                block['opened'] = round(sent * open_rate / 100)
                block['clicked'] = round(sent * click_rate / 100)
            except Exception:
                pass

        per_channel.append(block)
        for key in totals:
            totals[key] += block.get(key, 0)

    return {'totals': totals, 'per_channel': per_channel}