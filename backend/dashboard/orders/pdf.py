import io

from PIL import Image
import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


def _build_qr_image(order) -> ImageReader:
    payload = (
        f"https://racetechhub.co.ke/verify/{order.reference}"
        f"?token={order.verify_token or order.reference}"
    )
    qr: Image.Image = qrcode.make(payload)
    buf = io.BytesIO()
    qr.save(buf, "PNG")
    buf.seek(0)
    return ImageReader(buf)


def build_receipt_pdf(order) -> io.BytesIO:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    c.setFillColor(colors.HexColor("#0f172a"))
    c.rect(0, height - 30 * mm, width, 30 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(15 * mm, height - 15 * mm, "Racetech Hub Ltd")
    c.setFont("Helvetica", 10)
    c.drawString(
        15 * mm, height - 22 * mm,
        "Genuine Electronics · Nationwide Delivery",
    )
    c.drawRightString(width - 15 * mm, height - 15 * mm, "OFFICIAL RECEIPT")
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(
        width - 15 * mm, height - 22 * mm, f"#{order.reference}",
    )

    y = height - 45 * mm
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(15 * mm, y, "Billed to")
    c.setFont("Helvetica", 10)
    c.drawString(
        15 * mm, y - 6 * mm, order.customer_name or "Walk-in customer",
    )
    c.drawString(15 * mm, y - 12 * mm, order.customer_phone or "")
    c.drawString(15 * mm, y - 18 * mm, order.customer_email or "")

    c.setFont("Helvetica-Bold", 11)
    c.drawString(110 * mm, y, "Receipt details")
    c.setFont("Helvetica", 10)
    c.drawString(
        110 * mm, y - 6 * mm,
        f"Date: {order.created_at:%d %b %Y %H:%M}",
    )
    payment = order.successful_payment or order.latest_payment
    c.drawString(
        110 * mm, y - 12 * mm,
        f"M-Pesa: {payment.mpesa_receipt_number if payment else '—'}",
    )
    c.drawString(
        110 * mm, y - 18 * mm,
        f"Payment: {order.get_payment_status_display()}",
    )

    y -= 32 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(15 * mm, y, "Product")
    c.drawString(120 * mm, y, "Qty")
    c.drawString(140 * mm, y, "Unit")
    c.drawRightString(width - 15 * mm, y, "Subtotal")
    c.line(15 * mm, y - 2 * mm, width - 15 * mm, y - 2 * mm)

    y -= 8 * mm
    c.setFont("Helvetica", 10)
    for item in order.items.all():
        c.drawString(15 * mm, y, item.name[:60])
        c.drawString(120 * mm, y, str(item.quantity))
        c.drawString(140 * mm, y, f"{item.unit_price:,.2f}")
        c.drawRightString(width - 15 * mm, y, f"{item.line_total:,.2f}")

        if item.serial_number or item.imei:
            y -= 4 * mm
            c.setFont("Helvetica-Oblique", 8)
            parts = []
            if item.serial_number:
                parts.append(f"S/N {item.serial_number}")
            if item.imei:
                parts.append(f"IMEI {item.imei}")
            c.drawString(18 * mm, y, " · ".join(parts))
            c.setFont("Helvetica", 10)

        y -= 6 * mm

    c.line(15 * mm, y - 2 * mm, width - 15 * mm, y - 2 * mm)
    y -= 8 * mm
    for label, value in [
        ("Subtotal", f"{order.subtotal:,.2f}"),
        ("Shipping", f"{order.shipping:,.2f}"),
        ("VAT (16%)", f"{order.tax:,.2f}"),
    ]:
        c.drawRightString(140 * mm, y, label)
        c.drawRightString(width - 15 * mm, y, value)
        y -= 5 * mm

    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(140 * mm, y, "Total")
    c.drawRightString(width - 15 * mm, y, f"KES {order.total:,.2f}")

    qr = _build_qr_image(order)
    c.drawImage(
        qr,
        15 * mm, 20 * mm,
        width=30 * mm, height=30 * mm,
        preserveAspectRatio=True,
        mask="auto",
    )

    c.setFont("Helvetica", 8)
    c.setFillColor(colors.grey)
    c.drawString(
        15 * mm, 15 * mm,
        "Thank you for shopping with Racetech Hub Ltd!",
    )
    c.drawString(
        15 * mm, 11 * mm,
        "Warranty valid 12 months. Keep this receipt for return and service.",
    )

    c.showPage()
    c.save()
    buf.seek(0)
    return buf