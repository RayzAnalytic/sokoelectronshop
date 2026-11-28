from django.core.management.base import BaseCommand
from dashboard.social.models import AccountConnectionStatus, SocialAccount


class Command(BaseCommand):
    help = "Remove orphaned empty SocialAccount placeholders and stale not_connected duplicates."

    def handle(self, *args, **options):
        empty_qs = SocialAccount.objects.filter(account_id="")
        empty_cnt = empty_qs.count()
        for acc in empty_qs:
            self.stdout.write(f"Deleting empty placeholder: id={acc.id} platform={acc.platform} name={acc.display_name}")
        empty_qs.delete()

        dup_cnt = 0
        connected = list(SocialAccount.objects.filter(status=AccountConnectionStatus.CONNECTED).exclude(account_id=""))
        for c in connected:
            stale = SocialAccount.objects.filter(
                platform=c.platform,
                status=AccountConnectionStatus.NOT_CONNECTED,
            ).exclude(pk=c.pk)
            if c.username:
                stale = stale.filter(username__iexact=c.username)
            elif c.account_id:
                stale = stale.filter(account_id=c.account_id)
            else:
                continue
            for s in stale:
                if s.scheduled_posts.exists():
                    self.stdout.write(f"Skipping id={s.id} (has scheduled posts)")
                    continue
                self.stdout.write(f"Deleting stale duplicate: id={s.id} platform={s.platform} username={s.username}")
                s.delete()
                dup_cnt += 1

        self.stdout.write(self.style.SUCCESS(f"Done. Removed {empty_cnt} empty + {dup_cnt} duplicate stale rows."))
