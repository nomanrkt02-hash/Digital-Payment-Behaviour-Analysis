"""Design system: colours, status metadata, CSS and small HTML builders."""
from __future__ import annotations

import base64
import html as _html

import streamlit as st

BG, CARD, SIDEBAR = "#F5F7FB", "#FFFFFF", "#172554"
BLUE, TEAL = "#2563EB", "#0F766E"
INK, MUTED, BORDER = "#172033", "#64748B", "#E2E8F0"

STATUS = {
    "At Risk": dict(label="AT RISK", color="#DC2626", soft="#FEF2F2", emoji="🔴",
                    sentence="This customer is ordering less often than usual."),
    "Active / Normal": dict(label="ACTIVE / NORMAL", color="#D97706", soft="#FFFBEB", emoji="🟡",
                            sentence="This customer is following their usual ordering pattern."),
    "Loyal / High-Value": dict(label="LOYAL", color="#15803D", soft="#F0FDF4", emoji="🟢",
                               sentence="This customer is consistently active and loyal."),
    "Not enough history": dict(label="NOT SCORED", color="#64748B", soft="#F1F5F9", emoji="⚪",
                               sentence="This customer has too few orders to judge their behaviour yet."),
}
PRIORITY_COLOR = {"High": "#DC2626", "Medium": "#D97706", "Low": "#64748B"}

NAV = [("overview", "01", "Overview"), ("customers", "02", "Customer Analytics"),
       ("retention", "03", "Retention Insights"), ("segments", "04", "Customer Segments"),
       ("transactions", "05", "Transaction Data"), ("reports", "06", "Reports"), ("settings", "07", "Settings")]

_ICONS = {
    "overview": '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    "customers": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.4c1.9.8 3 2.7 3 5.6"/>',
    "retention": '<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
    "segments": '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    "transactions": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    "reports": '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    "settings": '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
}


def esc(x) -> str:
    return _html.escape(str(x))


def H(s: str) -> str:
    """Make an HTML snippet safe for st.markdown (no indented code blocks, no LaTeX from '$')."""
    lines = [ln.strip() for ln in s.strip().splitlines() if ln.strip()]
    return "\n".join(lines).replace("$", "&#36;")


def md(s: str) -> None:
    st.markdown(H(s), unsafe_allow_html=True)


def _icon_css(page: str) -> str:
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" '
           'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + _ICONS[page] + "</svg>")
    b64 = base64.b64encode(svg.encode()).decode()
    url = f"url(data:image/svg+xml;base64,{b64})"
    return (f'.st-key-nav_{page} button::before{{content:"";display:inline-block;width:18px;height:18px;'
            f'margin-right:12px;background-color:currentColor;-webkit-mask:{url} center/contain no-repeat;'
            f'mask:{url} center/contain no-repeat;flex:none}}')


BASE_CSS = f"""
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
html, body, .stApp, button, input, textarea, select {{font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif !important;}}
.stApp {{background:{BG};color:{INK};}}
#MainMenu, footer, [data-testid="stToolbar"] {{visibility:hidden;}}
[data-testid="stHeader"] {{background:transparent;}}
.block-container {{padding-top:1.6rem;padding-bottom:3rem;max-width:1320px;}}
h1,h2,h3,h4 {{color:{INK};letter-spacing:-0.01em;}}

/* ---------- sidebar ---------- */
section[data-testid="stSidebar"] {{background:linear-gradient(180deg,{SIDEBAR} 0%,#0F1B45 100%);border-right:none;}}
section[data-testid="stSidebar"] > div {{padding-top:1.2rem;}}
[class*="st-key-nav_"] button {{background:transparent;border:none;color:#C7D2FE;justify-content:flex-start;
  padding:.62rem .9rem;border-radius:12px;font-weight:500;width:100%;transition:all .15s ease;}}
[class*="st-key-nav_"] button p {{font-size:.95rem;}}
[class*="st-key-nav_"] button:hover {{background:rgba(255,255,255,.08);color:#fff;border:none;}}
[class*="st-key-nav_"] button:focus {{box-shadow:none;color:#fff;}}
.dp-brand {{display:flex;gap:12px;align-items:center;padding:4px 6px 18px 6px;}}
.dp-brand b {{display:block;color:#fff;font-size:15px;line-height:1.2;font-weight:700;}}
.dp-brand span {{color:#93A4D6;font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;}}
.dp-side-foot {{margin-top:28px;padding:14px;border-radius:14px;background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.08);color:#C7D2FE;font-size:12.5px;line-height:1.5;}}
.dp-side-foot b {{color:#fff;font-weight:600;}}

/* ---------- headings ---------- */
.dp-kicker {{color:{BLUE};font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px;}}
.dp-h1 {{font-size:30px;font-weight:700;letter-spacing:-0.02em;line-height:1.15;color:{INK};margin:0;}}
.dp-sub {{color:{MUTED};font-size:15px;margin-top:6px;margin-bottom:18px;}}
.dp-h2 {{font-size:17px;font-weight:650;color:{INK};margin:0 0 2px 0;}}
.dp-h2sub {{color:{MUTED};font-size:13.5px;margin-bottom:10px;}}
.dp-section {{font-size:12px;font-weight:700;color:{MUTED};letter-spacing:.1em;text-transform:uppercase;margin:22px 0 10px 0;}}

/* ---------- cards ---------- */
[class*="st-key-card"] {{background:{CARD};border:1px solid {BORDER};border-radius:18px;padding:20px 22px;
  box-shadow:0 1px 2px rgba(15,23,42,.04),0 8px 24px rgba(15,23,42,.04);transition:box-shadow .2s ease,transform .2s ease;}}
[class*="st-key-card"]:hover {{box-shadow:0 2px 4px rgba(15,23,42,.05),0 14px 32px rgba(15,23,42,.07);}}
.dp-card {{background:{CARD};border:1px solid {BORDER};border-radius:18px;padding:18px 20px;
  box-shadow:0 1px 2px rgba(15,23,42,.04),0 8px 24px rgba(15,23,42,.04);transition:all .2s ease;height:100%;}}
.dp-card.hover:hover {{transform:translateY(-2px);box-shadow:0 2px 4px rgba(15,23,42,.05),0 16px 34px rgba(15,23,42,.09);}}
.dp-kpi {{position:relative;overflow:hidden;}}
.dp-kpi .lbl {{color:{MUTED};font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;}}
.dp-kpi .val {{font-size:36px;font-weight:700;letter-spacing:-0.02em;color:{INK};margin:6px 0 2px 0;line-height:1.1;}}
.dp-kpi .desc {{color:{MUTED};font-size:13px;}}
.dp-kpi .bar {{height:5px;border-radius:99px;background:#EEF2F7;margin-top:14px;overflow:hidden;}}
.dp-kpi .bar i {{display:block;height:100%;border-radius:99px;}}
.dp-dot {{width:9px;height:9px;border-radius:99px;display:inline-block;}}
.dp-badge {{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:99px;font-size:11.5px;font-weight:700;
  letter-spacing:.04em;white-space:nowrap;}}
.dp-pri {{font-size:11.5px;font-weight:700;letter-spacing:.05em;white-space:nowrap;}}
.dp-chip {{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:99px;background:#fff;border:1px solid {BORDER};
  color:{INK};font-size:12.5px;font-weight:600;}}
.dp-chip.demo {{background:#EFF6FF;border-color:#BFDBFE;color:#1D4ED8;}}
.dp-muted {{color:{MUTED};}}
.dp-tile {{background:#F8FAFC;border:1px solid #EEF2F7;border-radius:14px;padding:12px 14px;}}
.dp-tile .t {{color:{MUTED};font-size:12px;font-weight:600;}}
.dp-tile .v {{font-size:21px;font-weight:700;color:{INK};margin-top:2px;}}
.dp-tile .s {{color:{MUTED};font-size:12px;}}
.dp-why {{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:14px;background:#F8FAFC;border:1px solid #EEF2F7;margin-bottom:8px;}}
.dp-why .n {{flex:none;width:24px;height:24px;border-radius:99px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;}}
.dp-why .x {{font-size:14.5px;color:{INK};line-height:1.45;}}
.dp-hero-status {{border-radius:20px;padding:24px 28px;border:1px solid;position:relative;overflow:hidden;}}
.dp-action {{border-radius:18px;padding:20px 22px;background:linear-gradient(135deg,#EFF6FF 0%,#F0FDFA 100%);border:1px solid #BFDBFE;}}
.dp-action .tag {{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:{TEAL};}}
.dp-action .ttl {{font-size:20px;font-weight:700;color:{INK};margin:6px 0 6px 0;}}
.dp-action .txt {{font-size:14.5px;color:#1E293B;line-height:1.55;}}
.dp-action .foot {{margin-top:12px;font-size:12px;color:{MUTED};}}
.dp-insight {{border-radius:18px;padding:20px 22px;background:linear-gradient(135deg,{SIDEBAR},#1E3A8A);color:#fff;height:100%;}}
.dp-insight .tag {{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#93C5FD;}}
.dp-insight p {{font-size:16px;line-height:1.55;margin:8px 0 0 0;color:#EFF6FF;}}
.dp-empty {{text-align:center;padding:36px 18px;color:{MUTED};}}
.dp-empty b {{display:block;color:{INK};font-size:16px;margin-bottom:4px;}}

/* ---------- validation + stepper ---------- */
.dp-check {{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid #F1F5F9;font-size:14px;}}
.dp-check:last-child {{border-bottom:none;}}
.dp-ic {{flex:none;width:20px;height:20px;border-radius:99px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;margin-top:1px;}}
.dp-steps {{display:flex;gap:0;align-items:center;margin:6px 0 14px 0;flex-wrap:wrap;}}
.dp-step {{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#94A3B8;}}
.dp-step .c {{width:24px;height:24px;border-radius:99px;border:2px solid #CBD5E1;display:flex;align-items:center;justify-content:center;font-size:11px;}}
.dp-step.on {{color:{BLUE};}} .dp-step.on .c {{border-color:{BLUE};background:{BLUE};color:#fff;}}
.dp-step.done {{color:#15803D;}} .dp-step.done .c {{border-color:#15803D;background:#15803D;color:#fff;}}
.dp-step-line {{width:34px;height:2px;background:#E2E8F0;margin:0 10px;}}

/* ---------- welcome ---------- */
.dp-hero {{padding:10px 4px 6px 4px;}}
.dp-hero h1 {{font-size:54px;line-height:1.02;font-weight:800;letter-spacing:-0.035em;color:{INK};margin:8px 0 14px 0;}}
.dp-hero h1 em {{font-style:normal;background:linear-gradient(90deg,{BLUE},{TEAL});-webkit-background-clip:text;background-clip:text;color:transparent;}}
.dp-hero .lead {{font-size:19px;color:#334155;max-width:760px;line-height:1.5;margin-bottom:6px;}}
.dp-hero .body {{font-size:15.5px;color:{MUTED};max-width:760px;line-height:1.6;}}
.dp-rhythm {{background:#fff;border:1px solid {BORDER};border-radius:20px;padding:10px 16px 2px 16px;margin:22px 0 8px 0;
  box-shadow:0 1px 2px rgba(15,23,42,.04),0 12px 32px rgba(15,23,42,.05);}}
.dp-choice h3 {{margin:2px 0 4px 0;font-size:20px;font-weight:700;}}
.dp-choice p {{margin:0 0 6px 0;color:{MUTED};font-size:14.5px;line-height:1.5;}}
.dp-flow {{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;color:{MUTED};font-size:13px;font-weight:600;}}

/* ---------- buttons / inputs ---------- */
button[kind="primary"] {{background:{BLUE};border:1px solid {BLUE};border-radius:12px;font-weight:600;padding:.55rem 1.1rem;transition:all .15s ease;}}
button[kind="primary"]:hover {{background:#1D4ED8;border-color:#1D4ED8;box-shadow:0 6px 16px rgba(37,99,235,.28);}}
button[kind="secondary"] {{border-radius:12px;font-weight:600;border:1px solid {BORDER};background:#fff;color:{INK};transition:all .15s ease;}}
button[kind="secondary"]:hover {{border-color:{BLUE};color:{BLUE};}}
[data-testid="stFileUploaderDropzone"] {{border:2px dashed #BFD0F5;border-radius:18px;background:#F8FAFF;padding:26px;}}
[data-testid="stDataFrame"] {{border:1px solid {BORDER};border-radius:14px;overflow:hidden;}}
[class*="st-key-attn_"] {{border-bottom:1px solid #EEF2F7;padding:8px 0;}}

@media (max-width: 768px) {{
  .block-container {{padding:1rem .8rem 3rem .8rem;}}
  .dp-hero h1 {{font-size:34px;}} .dp-hero .lead {{font-size:16px;}}
  .dp-h1 {{font-size:24px;}} .dp-kpi .val {{font-size:28px;}}
  .dp-step-line {{width:14px;margin:0 4px;}}
}}
"""


def inject_css(active_page: str | None, hide_sidebar: bool) -> None:
    css = BASE_CSS + "".join(_icon_css(p) for p, _, _ in NAV)
    if active_page:
        css += (f'.st-key-nav_{active_page} button{{background:rgba(255,255,255,.13);color:#fff;'
                f'box-shadow:inset 3px 0 0 #60A5FA;}}')
    if hide_sidebar:
        css += ('section[data-testid="stSidebar"], [data-testid="stSidebarCollapsedControl"], '
                '[data-testid="collapsedControl"]{display:none !important;}')
    st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)


BRAND_MARK = ('<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">'
              '<rect width="40" height="40" rx="11" fill="#2563EB"/><circle cx="9" cy="20" r="2.7" fill="#fff"/>'
              '<circle cx="17" cy="20" r="2.7" fill="#fff"/><path d="M22.5 20h7" stroke="#FCA5A5" stroke-width="2.4" '
              'stroke-dasharray="0.1 4.2" stroke-linecap="round"/><circle cx="33" cy="20" r="2.7" fill="none" '
              'stroke="#fff" stroke-width="1.8"/></svg>')

RHYTHM_STRIP = """
<svg viewBox="0 0 900 132" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Inter,system-ui,sans-serif">
<rect x="372" y="34" width="70" height="52" rx="10" fill="#DBEAFE" opacity=".75"/>
<text x="407" y="26" text-anchor="middle" font-size="12" font-weight="600" fill="#2563EB">expected next order</text>
<line x1="30" y1="60" x2="330" y2="60" stroke="#CBD5E1" stroke-width="2"/>
<g fill="#2563EB"><circle cx="40" cy="60" r="8"/><circle cx="112" cy="60" r="8"/><circle cx="184" cy="60" r="8"/>
<circle cx="256" cy="60" r="8"/><circle cx="328" cy="60" r="8"/></g>
<line x1="336" y1="60" x2="800" y2="60" stroke="#DC2626" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>
<circle cx="800" cy="60" r="9" fill="#fff" stroke="#DC2626" stroke-width="3"/>
<text x="184" y="104" text-anchor="middle" font-size="13" font-weight="600" fill="#334155">their usual rhythm: every 10-15 days</text>
<text x="600" y="104" text-anchor="middle" font-size="13" font-weight="700" fill="#DC2626">now: 35 days since the last order</text>
<text x="800" y="36" text-anchor="middle" font-size="12" font-weight="600" fill="#64748B">today</text>
</svg>"""
