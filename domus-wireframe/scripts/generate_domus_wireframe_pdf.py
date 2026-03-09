from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
import os
from datetime import datetime

PAGE_W, PAGE_H = letter

def draw_title(c, title, subtitle=None):
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(48, PAGE_H - 64, title)
    if subtitle:
        c.setFont("Helvetica", 11)
        c.setFillColor(colors.HexColor("#374151"))
        c.drawString(48, PAGE_H - 84, subtitle)
    c.setStrokeColor(colors.HexColor("#E5E7EB"))
    c.setLineWidth(1)
    c.line(48, PAGE_H - 96, PAGE_W - 48, PAGE_H - 96)

def box(c, x, y, w, h, label=None, fill=None, stroke=colors.HexColor("#111827"), lw=1):
    if fill:
        c.setFillColor(fill)
        c.rect(x, y, w, h, stroke=0, fill=1)
    c.setStrokeColor(stroke)
    c.setLineWidth(lw)
    c.rect(x, y, w, h, stroke=1, fill=0)
    if label:
        c.setFillColor(colors.HexColor("#111827"))
        c.setFont("Helvetica", 9)
        c.drawString(x + 8, y + h - 14, label)

def pill(c, x, y, w, h, text, fill=colors.HexColor("#EFF6FF"), stroke=colors.HexColor("#93C5FD")):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(1)
    c.roundRect(x, y, w, h, 6, stroke=1, fill=1)
    c.setFillColor(colors.HexColor("#1F2937"))
    c.setFont("Helvetica", 8.5)
    c.drawCentredString(x + w/2, y + (h/2) - 3, text)

def label(c, x, y, text, size=9, color=colors.HexColor("#374151"), bold=False):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x, y, text)

def money(c, x, y, text, size=14, color=colors.HexColor("#111827")):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", size)
    c.drawString(x, y, text)

def kpi_card(c, x, y, w, h, title, value, delta, state="neutral"):
    fills = {
        "neutral": colors.white,
        "success": colors.white,
        "warning": colors.white,
        "danger": colors.white
    }
    accents = {
        "neutral": colors.HexColor("#0F3D91"),
        "success": colors.HexColor("#0BA95B"),
        "warning": colors.HexColor("#F59E0B"),
        "danger": colors.HexColor("#DC2626")
    }
    box(c, x, y, w, h, fill=fills[state], stroke=colors.HexColor("#E5E7EB"), lw=1)
    c.setStrokeColor(accents[state])
    c.setLineWidth(3)
    c.line(x, y + h, x + w, y + h)
    label(c, x + 12, y + h - 22, title, size=9, color=colors.HexColor("#6B7280"))
    money(c, x + 12, y + h - 46, value, size=16, color=colors.HexColor("#111827"))
    label(c, x + 12, y + 12, delta, size=8.5, color=colors.HexColor("#6B7280"))

def draw_appshell_frame(c, title_right="Familia: Montaño", period="Marzo 2026"):
    bg = colors.HexColor("#F4F6F9")
    c.setFillColor(bg)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)

    # Header
    header_h = 56
    box(c, 0, PAGE_H - header_h, PAGE_W, header_h, fill=colors.white, stroke=colors.HexColor("#E5E7EB"), lw=1)
    label(c, 18, PAGE_H - 34, "DOMUS+", size=12, bold=True, color=colors.HexColor("#0F3D91"))
    pill(c, 110, PAGE_H - 41, 120, 22, title_right)
    pill(c, 238, PAGE_H - 41, 92, 22, period)
    pill(c, PAGE_W - 210, PAGE_H - 41, 120, 22, "Buscar")
    pill(c, PAGE_W - 82, PAGE_H - 41, 64, 22, "Perfil")

    # Sidebar
    sidebar_w = 168
    box(c, 0, 0, sidebar_w, PAGE_H - header_h, fill=colors.white, stroke=colors.HexColor("#E5E7EB"), lw=1)
    y = PAGE_H - header_h - 36
    items = ["Dashboard", "Presupuesto", "Transacciones", "Categorias", "Miembros", "Banco Domus", "Reportes", "Configuracion"]
    for i, it in enumerate(items):
        is_active = (it == "Dashboard")
        if is_active:
            c.setFillColor(colors.HexColor("#E8F0FF"))
            c.roundRect(12, y - 6, sidebar_w - 24, 24, 6, stroke=0, fill=1)
            c.setFillColor(colors.HexColor("#0F3D91"))
            c.setFont("Helvetica-Bold", 9.5)
        else:
            c.setFillColor(colors.HexColor("#374151"))
            c.setFont("Helvetica", 9.5)
        c.drawString(24, y, it)
        y -= 28

    # Content frame
    content_x = sidebar_w + 18
    content_y = 24
    content_w = PAGE_W - content_x - 18
    content_h = PAGE_H - header_h - content_y - 18
    return content_x, content_y, content_w, content_h

def page_cover(c):
    c.setFillColor(colors.white)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.setFillColor(colors.HexColor("#0F3D91"))
    c.setFont("Helvetica-Bold", 26)
    c.drawString(48, PAGE_H - 120, "DOMUS+")
    c.setFillColor(colors.HexColor("#111827"))
    c.setFont("Helvetica-Bold", 18)
    c.drawString(48, PAGE_H - 152, "Wireframe Blueprint")
    c.setFillColor(colors.HexColor("#6B7280"))
    c.setFont("Helvetica", 11)
    c.drawString(48, PAGE_H - 176, "SAP-Family Design System v1.0")
    c.setStrokeColor(colors.HexColor("#E5E7EB"))
    c.setLineWidth(1)
    c.line(48, PAGE_H - 200, PAGE_W - 48, PAGE_H - 200)

    # Tokens preview
    label(c, 48, PAGE_H - 230, "Tokens (resumen)", size=11, bold=True, color=colors.HexColor("#111827"))
    tokens = [
        ("Primario", "#0F3D91"), ("Secundario", "#2F6FED"),
        ("Fondo", "#F4F6F9"), ("Success", "#0BA95B"),
        ("Warning", "#F59E0B"), ("Danger", "#DC2626"),
        ("Texto", "#1F2937"), ("Muted", "#6B7280")
    ]
    x = 48
    y = PAGE_H - 260
    for name, hx in tokens:
        c.setFillColor(colors.HexColor(hx))
        c.roundRect(x, y, 110, 24, 6, stroke=0, fill=1)
        c.setFillColor(colors.white if name in ("Primario","Secundario","Texto") else colors.HexColor("#111827"))
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + 10, y + 7, f"{name} {hx}")
        x += 120
        if x > PAGE_W - 160:
            x = 48
            y -= 34

    # Principles
    y0 = 260
    label(c, 48, y0, "Principios", size=11, bold=True, color=colors.HexColor("#111827"))
    principles = [
        "Claridad financiera absoluta (KPI -> Categoria -> Transaccion -> Detalle).",
        "Jerarquia tipo ERP (patrones Overview / List Report / Object Page / Analytical).",
        "Familiar pero profesional (confiable, sin ruido visual).",
        "Modular y escalable (roles, auditoria, reglas, automatizacion).",
    ]
    yy = y0 - 22
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor("#374151"))
    for p in principles:
        c.drawString(60, yy, f"- {p}")
        yy -= 16

    c.setFillColor(colors.HexColor("#6B7280"))
    c.setFont("Helvetica", 9)
    c.drawString(48, 36, f"Generado: {datetime.now().strftime('%Y-%m-%d %H:%M')}")

def page_dashboard(c):
    draw_title(c, "1) Dashboard (Overview Page)", "Header + Sidebar + KPI Strip + Analitica + Tabla (estilo SAP-Family)")
    content_x, content_y, content_w, content_h = draw_appshell_frame(c)

    # KPI strip
    kpi_h = 78
    kpi_y = PAGE_H - 56 - 18 - kpi_h
    kpi_w = (content_w - 24) / 4
    kpi_card(c, content_x, kpi_y, kpi_w, kpi_h, "Presupuesto Total", "$ 52,000", "vs mes anterior: +2.1%", "neutral")
    kpi_card(c, content_x + (kpi_w + 8)*1, kpi_y, kpi_w, kpi_h, "Gastado", "$ 31,450", "progreso: 60.5%", "warning")
    kpi_card(c, content_x + (kpi_w + 8)*2, kpi_y, kpi_w, kpi_h, "Disponible", "$ 20,550", "estado: saludable", "success")
    kpi_card(c, content_x + (kpi_w + 8)*3, kpi_y, kpi_w, kpi_h, "Alertas", "3", "sobregasto: 1", "danger")

    # Analytics row
    an_y = kpi_y - 18 - 170
    left_w = (content_w - 12) * 0.62
    right_w = (content_w - 12) - left_w
    box(c, content_x, an_y, left_w, 170, label="Grafica mensual (barras) - 6 meses", fill=colors.white, stroke=colors.HexColor("#E5E7EB"), lw=1)
    # fake bars
    bx = content_x + 18
    by = an_y + 20
    for i, h in enumerate([60, 92, 48, 110, 72, 95]):
        c.setFillColor(colors.HexColor("#D6E4FF"))
        c.rect(bx + i*26, by, 14, h, stroke=0, fill=1)
    box(c, content_x + left_w + 12, an_y, right_w, 170, label="Distribucion por categorias (donut)", fill=colors.white, stroke=colors.HexColor("#E5E7EB"), lw=1)
    # donut placeholder
    c.setStrokeColor(colors.HexColor("#CBD5E1"))
    c.setLineWidth(8)
    cx = content_x + left_w + 12 + right_w/2
    cy = an_y + 85
    c.circle(cx, cy, 42)

    # Table
    tbl_h = an_y - content_y - 18
    box(c, content_x, content_y, content_w, tbl_h, label="Transacciones recientes (tabla)", fill=colors.white, stroke=colors.HexColor("#E5E7EB"), lw=1)
    # header row
    c.setFillColor(colors.HexColor("#F3F4F6"))
    c.rect(content_x + 1, content_y + tbl_h - 34, content_w - 2, 33, stroke=0, fill=1)
    cols = [("Fecha", 70), ("Entidad", 120), ("Categoria", 120), ("Miembro", 90), ("Metodo", 80), ("Monto", 80), ("Estado", 70)]
    x = content_x + 12
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.HexColor("#374151"))
    for name, w in cols:
        c.drawString(x, content_y + tbl_h - 22, name)
        x += w
    # rows placeholders
    c.setFont("Helvetica", 9)
    y = content_y + tbl_h - 54
    for r in range(8):
        c.setFillColor(colors.HexColor("#111827"))
        c.drawString(content_x + 12, y, "2026-03-0" + str((r % 9) + 1))
        c.setFillColor(colors.HexColor("#6B7280"))
        c.drawString(content_x + 82, y, "HEB / Costco / Gas")
        c.drawString(content_x + 202, y, "Alimentos / Hogar")
        c.drawString(content_x + 322, y, "Emiliano")
        c.drawString(content_x + 412, y, "Tarjeta")
        c.setFillColor(colors.HexColor("#111827"))
        c.drawRightString(content_x + 12 + 70+120+120+90+80+80 - 2, y, "$ 1,245")
        c.setFillColor(colors.HexColor("#0BA95B" if r % 3 else "#F59E0B"))
        c.drawString(content_x + content_w - 70, y, "OK" if r % 3 else "REV")
        c.setStrokeColor(colors.HexColor("#E5E7EB"))
        c.setLineWidth(1)
        c.line(content_x + 1, y - 10, content_x + content_w - 1, y - 10)
        y -= 22

def page_list_report(c):
    draw_title(c, "2) Presupuesto (List Report)", "Filter Bar + Tabla/Lista como motor operativo (patron SAP)")
    content_x, content_y, content_w, content_h = draw_appshell_frame(c)

    # Filter bar
    fb_h = 58
    fb_y = PAGE_H - 56 - 18 - fb_h
    box(c, content_x, fb_y, content_w, fb_h, label="Filter Bar", fill=colors.white, stroke=colors.HexColor("#E5E7EB"), lw=1)
    pill(c, content_x + 14, fb_y + 18, 120, 22, "Categoria: Todas")
    pill(c, content_x + 142, fb_y + 18, 140, 22, "Miembro: Todos")
    pill(c, content_x + 290, fb_y + 18, 120, 22, "Estado: Todos")
    pill(c, content_x + 418, fb_y + 18, 120, 22, "Rango: Mes")
    pill(c, content_x + content_w - 150, fb_y + 18, 130, 22, "Accion: Exportar")

    # Content split
    left_w = (content_w - 12) * 0.68
    right_w = (content_w - 12) - left_w
    top_y = fb_y - 12 - 240
    box(c, content_x, top_y, left_w, 240, label="Tabla categorias (presupuesto vs gasto)", fill=colors.white, stroke=colors.HexColor("#E5E7EB"), lw=1)

    # table header
    c.setFillColor(colors.HexColor("#F3F4F6"))
    c.rect(content_x + 1, top_y + 240 - 34, left_w - 2, 33, stroke=0, fill=1)
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.HexColor("#374151"))
    headers = [("Categoria", 190), ("Presup.", 70), ("Gastado", 70), ("Disp.", 70), ("Progreso", 80)]
    x = content_x + 12
    for h, w in headers:
        c.drawString(x, top_y + 240 - 22, h)
        x += w

    # rows
    c.setFont("Helvetica", 9)
    y = top_y + 240 - 54
    rows = ["Alimentos", "Gasolina", "Servicios", "Hogar", "Salud", "Escuela", "Mascotas"]
    for i, cat in enumerate(rows):
        c.setFillColor(colors.HexColor("#111827"))
        c.drawString(content_x + 12, y, cat)
        c.setFillColor(colors.HexColor("#6B7280"))
        c.drawRightString(content_x + 12 + 190 + 70 - 6, y, "$ 8,000")
        c.drawRightString(content_x + 12 + 190 + 70 + 70 - 6, y, "$ 5,450")
        c.setFillColor(colors.HexColor("#111827"))
        c.drawRightString(content_x + 12 + 190 + 70 + 70 + 70 - 6, y, "$ 2,550")
        # progress bar
        px = content_x + 12 + 190 + 70 + 70 + 70 + 10
        py = y - 6
        c.setFillColor(colors.HexColor("#E5E7EB"))
        c.rect(px, py, 70, 8, stroke=0, fill=1)
        c.setFillColor(colors.HexColor("#2F6FED"))
        c.rect(px, py, 50, 8, stroke=0, fill=1)
        c.setStrokeColor(colors.HexColor("#E5E7EB"))
        c.line(content_x + 1, y - 10, content_x + left_w - 1, y - 10)
        y -= 22

    box(c, content_x + left_w + 12, top_y, right_w, 240, label="Panel estado del mes", fill=colors.white, stroke=colors.HexColor("#E5E7EB"), lw=1)
    label(c, content_x + left_w + 24, top_y + 240 - 60, "Semaforo financiero", size=10, bold=True, color=colors.HexColor("#111827"))
    pill(c, content_x + left_w + 24, top_y + 240 - 92, right_w - 24, 22, "Estado: Saludable")
    pill(c, content_x + left_w + 24, top_y + 240 - 120, right_w - 24, 22, "Alertas: 3")
    pill(c, content_x + left_w + 24, top_y + 240 - 148, right_w - 24, 22, "Reglas activas: 12")

    # Lower table - transactions filtered
    lower_h = top_y - content_y - 18
    box(c, content_x, content_y, content_w, lower_h, label="Transacciones filtradas (contexto)", fill=colors.white, stroke=colors.HexColor("#E5E7EB"), lw=1)

def page_object_page(c):
    draw_title(c, "3) Detalle de Transaccion (Object Page)", "Object Header + Tabs + Evidencias + Auditoria (nivel ERP)")
    content_x, content_y, content_w, content_h = draw_appshell_frame(c)

    # Object header
    oh_h = 86
    oh_y = PAGE_H - 56 - 18 - oh_h
    box(c, content_x, oh_y, content_w, oh_h, label="Object Header", fill=colors.white, stroke=colors.HexColor("#E5E7EB"), lw=1)
    label(c, content_x + 14, oh_y + oh_h - 40, "HEB - Compra supermercado", size=12, bold=True, color=colors.HexColor("#111827"))
    money(c, content_x + 14, oh_y + oh_h - 64, "$ 1,245.00", size=16, color=colors.HexColor("#111827"))
    pill(c, content_x + content_w - 300, oh_y + oh_h - 44, 90, 22, "Editar")
    pill(c, content_x + content_w - 204, oh_y + oh_h - 44, 90, 22, "Split")
    pill(c, content_x + content_w - 108, oh_y + oh_h - 44, 90, 22, "Anexar")

    # Tabs
    tabs_y = oh_y - 12 - 34
    box(c, content_x, tabs_y, content_w, 34, fill=colors.white, stroke=colors.HexColor("#E5E7EB"), lw=1)
    tab_names = ["Detalle", "Split", "Evidencias", "Historial"]
    tx = content_x + 14
    for i, t in enumerate(tab_names):
        if i == 0:
            c.setFillColor(colors.HexColor("#0F3D91"))
            c.roundRect(tx - 6, tabs_y + 8, 70, 18, 8, stroke=0, fill=1)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Bold", 9)
        else:
            c.setFillColor(colors.HexColor("#374151"))
            c.setFont("Helvetica", 9)
        c.drawString(tx, tabs_y + 14, t)
        tx += 78

    # Body split: form + receipt + audit
    body_top = tabs_y - 12
    left_w = (content_w - 12) * 0.62
    right_w = (content_w - 12) - left_w
    body_h = body_top - content_y
    box(c, content_x, content_y, left_w, body_h, label="Formulario (campos financieros)", fill=colors.white, stroke=colors.HexColor("#E5E7EB"), lw=1)
    fx = content_x + 14
    fy = body_top - 40
    fields = [("Fecha", "2026-03-08"), ("Entidad", "HEB"), ("Categoria", "Alimentos"), ("Miembro", "Emiliano"), ("Metodo", "Tarjeta"), ("Notas", "Compra semanal")]
    for k, v in fields:
        label(c, fx, fy, k, size=9, bold=True, color=colors.HexColor("#6B7280"))
        box(c, fx, fy - 22, left_w - 28, 18, fill=colors.HexColor("#F9FAFB"), stroke=colors.HexColor("#E5E7EB"), lw=1)
        label(c, fx + 8, fy - 18, v, size=9, color=colors.HexColor("#111827"))
        fy -= 48

    box(c, content_x + left_w + 12, content_y + body_h*0.45, right_w, body_h*0.55, label="Evidencia (recibo / archivo)", fill=colors.white, stroke=colors.HexColor("#E5E7EB"), lw=1)
    box(c, content_x + left_w + 12, content_y, right_w, body_h*0.42, label="Auditoria (quien/cambio)", fill=colors.white, stroke=colors.HexColor("#E5E7EB"), lw=1)

def page_mobile(c):
    draw_title(c, "4) Mobile (Operacion diaria)", "Bottom Nav + Captura rapida (Add) + KPI horizontal")
    c.setFillColor(colors.white)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)

    # phone frame
    px = 210
    py = 96
    pw = 195
    ph = 420
    c.setStrokeColor(colors.HexColor("#111827"))
    c.setLineWidth(1.5)
    c.roundRect(px, py, pw, ph, 18, stroke=1, fill=0)

    # top bar
    c.setFillColor(colors.HexColor("#F4F6F9"))
    c.roundRect(px+10, py+ph-56, pw-20, 46, 12, stroke=0, fill=1)
    label(c, px+22, py+ph-38, "DOMUS+", size=10, bold=True, color=colors.HexColor("#0F3D91"))
    pill(c, px+105, py+ph-44, 70, 22, "Marzo")

    # KPI horizontal cards
    y = py + ph - 120
    for i, t in enumerate(["Total", "Gastado", "Disp.", "Alertas"]):
        c.setFillColor(colors.white)
        c.roundRect(px+10 + i*46, y, 42, 44, 10, stroke=1, fill=1)
        c.setStrokeColor(colors.HexColor("#E5E7EB"))
        c.setLineWidth(1)
        c.roundRect(px+10 + i*46, y, 42, 44, 10, stroke=1, fill=0)
        c.setFillColor(colors.HexColor("#6B7280"))
        c.setFont("Helvetica", 7.5)
        c.drawCentredString(px+10 + i*46 + 21, y+30, t)
        c.setFillColor(colors.HexColor("#111827"))
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(px+10 + i*46 + 21, y+14, "$$")

    # list area
    box(c, px+10, py+70, pw-20, 230, label="Lista (transacciones)", fill=colors.HexColor("#FFFFFF"), stroke=colors.HexColor("#E5E7EB"), lw=1)

    # bottom nav
    c.setFillColor(colors.HexColor("#F3F4F6"))
    c.roundRect(px+10, py+12, pw-20, 48, 14, stroke=0, fill=1)
    labels = ["Dash", "Budg", "+", "Memb", "Cfg"]
    for i, t in enumerate(labels):
        c.setFillColor(colors.HexColor("#0F3D91") if t == "Dash" else colors.HexColor("#6B7280"))
        c.setFont("Helvetica-Bold" if t == "Dash" else "Helvetica", 8.5)
        c.drawCentredString(px+20 + i*((pw-40)/4), py+30, t)

def build_pdf(out_path):
    c = canvas.Canvas(out_path, pagesize=letter)
    page_cover(c)
    c.showPage()
    page_dashboard(c)
    c.showPage()
    page_list_report(c)
    c.showPage()
    page_object_page(c)
    c.showPage()
    page_mobile(c)
    c.showPage()
    c.save()

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    exports = os.path.join(root, "exports")
    os.makedirs(exports, exist_ok=True)
    out_path = os.path.join(exports, "DOMUS_Wireframe_Blueprint_SAP-Family_v1.pdf")
    build_pdf(out_path)
    print("OK ->", out_path)

if __name__ == "__main__":
    main()
