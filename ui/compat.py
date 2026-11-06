"""Small helpers so the UI works across Streamlit versions."""
from __future__ import annotations

import streamlit as st


def stretch(fn, *args, **kwargs):
    """Call a Streamlit element so that it fills the available width (new + old API)."""
    try:
        return fn(*args, width="stretch", **kwargs)
    except Exception:  # noqa: BLE001 - older Streamlit
        return fn(*args, use_container_width=True, **kwargs)


def kcontainer(key: str):
    """Container with a CSS hook (st-key-<key>) - falls back to a bordered container."""
    try:
        return st.container(key=key)
    except TypeError:
        return st.container(border=True)


def table(df, **kwargs):
    """st.dataframe with row selection when supported. Returns selected row position or None."""
    try:
        ev = stretch(st.dataframe, df, hide_index=True, on_select="rerun", selection_mode="single-row", **kwargs)
        rows = ev.selection.rows if hasattr(ev, "selection") else []
        return rows[0] if rows else None
    except TypeError:
        stretch(st.dataframe, df, hide_index=True, **{k: v for k, v in kwargs.items() if k != "key"})
        return None


def plot(fig, key: str | None = None):
    kw = {"config": {"displayModeBar": False}}
    if key:
        kw["key"] = key
    return stretch(st.plotly_chart, fig, **kw)
