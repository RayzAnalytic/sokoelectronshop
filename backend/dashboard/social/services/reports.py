from __future__ import annotations

import csv
import io
import json
import logging
import re
from datetime import date, datetime
from typing import Any

from django.core.files.base import ContentFile
from django.db.models import Sum
from django.utils import timezone

logger = logging.getLogger("social.reports")


class ReportGenerationError(Exception):
    pass


def _collect_rows(report) -> list[dict[str, Any]]:
    from ..models import SocialPostTarget, TargetStatus

    qs = SocialPostTarget.objects.filter(
        status=TargetStatus.PUBLISHED,
        published_at__date__gte=report.date_from,
        published_at__date__lte=report.date_to,
    )

    if report.platforms:
        qs = qs.filter(platform__in=[p.upper() for p in report.platforms])

    rows = (
        qs.values("platform", "published_at__date")
        .annotate(
            posts=Sum("id"),
            likes=Sum("likes"),
            comments=Sum("comments"),
            shares=Sum("shares"),
            reach=Sum("reach"),
            impressions=Sum("impressions"),
            video_views=Sum("video_views"),
            link_clicks=Sum("link_clicks"),
        )
        .order_by("platform", "published_at__date")
    )

    out: list[dict[str, Any]] = []
    for r in rows:
        likes = r["likes"] or 0
        comments = r["comments"] or 0
        shares = r["shares"] or 0
        reach = r["reach"] or 0
        engagement = likes + comments + shares
        engagement_rate = round((engagement / reach) * 100, 2) if reach else 0.0

        out.append({
            "platform": r["platform"],
            "date": r["published_at__date"],
            "posts": r["posts"] or 0,
            "likes": likes,
            "comments": comments,
            "shares": shares,
            "reach": reach,
            "impressions": r["impressions"] or 0,
            "video_views": r["video_views"] or 0,
            "link_clicks": r["link_clicks"] or 0,
            "engagement": engagement,
            "engagement_rate": engagement_rate,
        })
    return out


def _write_csv(rows: list[dict[str, Any]]) -> bytes:
    buf = io.StringIO()
    fieldnames = [
        "platform", "date", "posts",
        "likes", "comments", "shares",
        "reach", "impressions", "video_views", "link_clicks",
        "engagement", "engagement_rate",
    ]
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow({k: row.get(k, "") for k in fieldnames})
    return buf.getvalue().encode("utf-8")


def _write_json(rows: list[dict[str, Any]]) -> bytes:
    safe = []
    for row in rows:
        r = dict(row)
        if isinstance(r.get("date"), (date, datetime)):
            r["date"] = r["date"].isoformat()
        safe.append(r)
    return json.dumps(
        {"generated_at": timezone.now().isoformat(), "rows": safe},
        indent=2,
    ).encode("utf-8")


def _write_pdf(rows: list[dict[str, Any]], report) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import (
            Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
        )
    except ImportError:
        logger.warning("reportlab not installed — falling back to JSON report")
        return _write_json(rows)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    styles = getSampleStyleSheet()

    story = [
        Paragraph(report.name or "Social report", styles["Title"]),
        Paragraph(
            f"{report.date_from.isoformat()} → {report.date_to.isoformat()}",
            styles["Normal"],
        ),
        Spacer(1, 12),
    ]

    if rows:
        headers = [
            "Platform", "Date", "Posts",
            "Likes", "Comments", "Shares",
            "Reach", "Impr.", "Views", "Clicks", "ER %",
        ]
        data = [headers] + [
            [
                r["platform"], str(r["date"]), r["posts"],
                r["likes"], r["comments"], r["shares"],
                r["reach"], r["impressions"], r["video_views"],
                r["link_clicks"], f"{r['engagement_rate']}%",
            ]
            for r in rows
        ]
        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#172554")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        story.append(table)
    else:
        story.append(Paragraph("No data for the selected range.", styles["Normal"]))

    doc.build(story)
    return buf.getvalue()


def _write_png(rows: list[dict[str, Any]], report) -> bytes:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        logger.warning("matplotlib not installed — falling back to JSON report")
        return _write_json(rows)

    buf = io.BytesIO()
    if not rows:
        plt.figure(figsize=(8, 4))
        plt.text(0.5, 0.5, "No data for the selected range",
                 ha="center", va="center")
        plt.axis("off")
    else:
        by_platform: dict[str, int] = {}
        for r in rows:
            by_platform[r["platform"]] = by_platform.get(r["platform"], 0) + r["engagement"]
        plt.figure(figsize=(8, 4))
        plt.bar(list(by_platform.keys()), list(by_platform.values()),
                color="#10b981")
        plt.title(report.name or "Engagement by platform")
        plt.ylabel("Engagement")
        plt.tight_layout()

    plt.savefig(buf, format="png", dpi=140)
    plt.close()
    return buf.getvalue()


def build_report_file(report):
    rows = _collect_rows(report)

    fmt = (report.format or "PDF").upper()
    if fmt == "CSV":
        payload = _write_csv(rows)
        ext = "csv"
    elif fmt == "PNG":
        payload = _write_png(rows, report)
        ext = "png"
    elif fmt == "PDF":
        payload = _write_pdf(rows, report)
        ext = "pdf"
    else:
        raise ReportGenerationError(f"Unsupported report format: {report.format}")

    stamp = timezone.now().strftime("%Y%m%d-%H%M%S")
    slug = _slugify(report.name or "social-report")
    filename = f"{slug}-{stamp}.{ext}"

    return ContentFile(payload, name=filename)


def _slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value or "social-report"


__all__ = ["build_report_file", "ReportGenerationError"]