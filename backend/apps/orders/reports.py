"""PDF rendering for the distributor sales report (doc 14)."""

import io


def render_report_pdf(hotel, start, end, data: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 25 * mm

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(20 * mm, y, f"{hotel.name} — Sales report")
    y -= 7 * mm
    pdf.setFont("Helvetica", 10)
    pdf.drawString(20 * mm, y, f"Period: {start} to {end}")

    y -= 12 * mm
    pdf.setFont("Helvetica-Bold", 11)
    for label, value in (
        ("Total sales", f"{data['total_sales']:.2f}"),
        ("Total orders", str(data["total_orders"])),
        ("Average ticket", f"{data['avg_order_value']:.2f}"),
    ):
        pdf.drawString(20 * mm, y, label)
        pdf.drawRightString(90 * mm, y, value)
        y -= 6 * mm

    # Daily revenue bars
    series = data["daily_series"]
    if series:
        peak = max((row["sales"] for row in series), default=0) or 1
        chart_top, chart_bottom = y - 6 * mm, y - 46 * mm
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(20 * mm, chart_top + 4 * mm, "Daily revenue")
        bar_width = min(14 * mm, (160 * mm) / max(len(series), 1) - 2 * mm)
        for index, row in enumerate(series):
            x = 20 * mm + index * (bar_width + 2 * mm)
            bar_height = (row["sales"] / peak) * 34 * mm
            pdf.setFillColorRGB(0.95, 0.55, 0.15)
            pdf.rect(x, chart_bottom, bar_width, bar_height, stroke=0, fill=1)
            pdf.setFillColorRGB(0.3, 0.3, 0.3)
            pdf.setFont("Helvetica", 6)
            pdf.drawString(x, chart_bottom - 4 * mm, row["date"][5:])
        pdf.setFillColorRGB(0, 0, 0)
        y = chart_bottom - 14 * mm

    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(20 * mm, y, "Top performing items")
    y -= 7 * mm
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(20 * mm, y, "Item")
    pdf.drawRightString(130 * mm, y, "Units")
    pdf.drawRightString(160 * mm, y, "Revenue")
    pdf.drawRightString(190 * mm, y, "Rating")
    pdf.setFont("Helvetica", 9)
    for row in data["top_items"]:
        y -= 6 * mm
        pdf.drawString(20 * mm, y, row["name"][:55])
        pdf.drawRightString(130 * mm, y, str(row["qty_sold"]))
        pdf.drawRightString(160 * mm, y, f"{row['revenue']:.2f}")
        pdf.drawRightString(190 * mm, y, f"{row['rating'] or '—'}")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
