"""Reusable UI pieces (HTML builders + a few Streamlit helpers)."""
from __future__ import annotations

import streamlit as st

from . import state as S
from .compat import kcontainer
from .theme import MUTED, PRIORITY_COLOR, STATUS, esc, H, md


def money(v, sym=None) -> str:
    sym = sym if sym is not None else S.currency()
    if v is None or v != v:
        return "–"
    return f"{sym}{v:,.0f}"


def page_header(kicker: str, title: str, sub: str) -> None:
    md(f'<div><div class="dp-kicker">{esc(kicker)}</div><div class="dp-h1">{esc(title)}</div>'
       f'<div class="dp-sub">{esc(sub)}</div></div>')


def section(title: str) -> None:
    md(f'<div class="dp-section">{esc(title)}</div>')


def card_title(title: str, sub: str = "") -> None:
    s = f'<div class="dp-h2sub">{esc(sub)}</div>' if sub else ""
    md(f'<div><div class="dp-h2">{esc(title)}</div>{s}</div>')


def badge(status: str) -> str:
    m = STATUS.get(status, STATUS["Not enough history"])
    return (f'<span class="dp-badge" style="background:{m["soft"]};color:{m["color"]};border:1px solid {m["color"]}33">'
            f'<span class="dp-dot" style="background:{m["color"]}"></span>{m["label"]}</span>')


def priority(p: str) -> str:
    return f'<span class="dp-pri" style="color:{PRIORITY_COLOR.get(p, MUTED)}">{esc(str(p).upper())} PRIORITY</span>'


def chip(text: str, demo: bool = False) -> str:
    return f'<span class="dp-chip{" demo" if demo else ""}">{esc(text)}</span>'


def dataset_chip() -> str:
    label = st.session_state.data_label or "No dataset"
    r = S.result()
    n = f" · {r.summary['total_customers']:,} customers" if r and r.ok else ""
    dot = '<span class="dp-dot" style="background:#15803D"></span>' if r and r.ok else ""
    return f'<span class="dp-chip{" demo" if st.session_state.is_demo else ""}">{dot}{esc(label)}{esc(n)}</span>'


def kpi(label: str, value, desc: str, color: str, share: float | None = None) -> str:
    bar = ""
    if share is not None:
        bar = f'<div class="bar"><i style="width:{max(2, min(100, share * 100)):.0f}%;background:{color}"></i></div>'
    return H(f'''<div class="dp-card dp-kpi hover"><div class="lbl"><span class="dp-dot" style="background:{color}"></span>{esc(label)}</div>
        <div class="val">{value}</div><div class="desc">{esc(desc)}</div>{bar}</div>''')


def tile(title: str, value: str, sub: str = "") -> str:
    s = f'<div class="s">{esc(sub)}</div>' if sub else ""
    return f'<div class="dp-tile"><div class="t">{esc(title)}</div><div class="v">{value}</div>{s}</div>'


def why_cards(items: list[str], color: str) -> str:
    out = "".join(f'<div class="dp-why"><div class="n" style="background:{color}">{i + 1}</div>'
                  f'<div class="x">{esc(t)}</div></div>' for i, t in enumerate(items))
    return H(f"<div>{out}</div>")


def check_row(kind: str, text: str, sub: str = "") -> str:
    color, sym = {"ok": ("#15803D", "✓"), "warn": ("#D97706", "!"), "err": ("#DC2626", "×")}[kind]
    s = f'<div class="dp-muted" style="font-size:12.5px">{esc(sub)}</div>' if sub else ""
    return (f'<div class="dp-check"><div class="dp-ic" style="background:{color}">{sym}</div>'
            f'<div><div>{esc(text)}</div>{s}</div></div>')


def stepper(active: int) -> None:
    """active: 0 Upload, 1 Validate, 2 Process, 3 Analyse (steps before it are shown as done)."""
    names = ["Upload", "Validate", "Process", "Analyse"]
    parts = []
    for i, n in enumerate(names):
        cls = "done" if i < active else ("on" if i == active else "")
        mark = "✓" if i < active else str(i + 1)
        parts.append(f'<div class="dp-step {cls}"><div class="c">{mark}</div>{n}</div>')
        if i < len(names) - 1:
            parts.append('<div class="dp-step-line"></div>')
    md(f'<div class="dp-steps">{"".join(parts)}</div>')


def empty_state(title: str, msg: str) -> None:
    md(f'<div class="dp-empty"><b>{esc(title)}</b>{esc(msg)}</div>')


def card(key: str):
    return kcontainer(f"card_{key}")
