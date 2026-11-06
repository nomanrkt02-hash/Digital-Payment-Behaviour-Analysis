"""Plotly figures. Restrained, readable, consistent with the design system."""
from __future__ import annotations

import numpy as np
import pandas as pd
import plotly.graph_objects as go

from .theme import BLUE, BORDER, INK, MUTED, STATUS, TEAL

FONT = dict(family="Inter, system-ui, sans-serif", color=INK, size=13)


def _base(fig, height=320, legend=False, margin=None):
    fig.update_layout(
        height=height, margin=margin or dict(l=8, r=8, t=8, b=8), font=FONT,
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", showlegend=legend,
        hoverlabel=dict(bgcolor="white", bordercolor=BORDER, font=dict(family=FONT["family"], size=13, color=INK)),
    )
    return fig


def _axes(fig, grid_y=True):
    fig.update_xaxes(showgrid=False, linecolor=BORDER, tickfont=dict(color=MUTED, size=12), zeroline=False)
    fig.update_yaxes(showgrid=grid_y, gridcolor="#EEF2F7", zeroline=False, tickfont=dict(color=MUTED, size=12))
    return fig


# ------------------------------------------------------------------ overview
def return_trend(trend: pd.DataFrame, height=330):
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=trend["snapshot"], y=trend["return_rate"] * 100, mode="lines+markers",
        line=dict(color=BLUE, width=3, shape="spline", smoothing=0.5), marker=dict(size=7, color="#fff", line=dict(color=BLUE, width=2.5)),
        fill="tozeroy", fillcolor="rgba(37,99,235,0.08)",
        customdata=np.stack([trend["customers"], trend["returned"]], axis=-1),
        hovertemplate="<b>%{x|%d %b %Y}</b><br>%{y:.0f}% ordered again within 30 days"
                      "<br>%{customdata[1]:,} of %{customdata[0]:,} customers<extra></extra>"))
    lo = max(0, float(trend["return_rate"].min() * 100) - 12)
    fig.update_yaxes(ticksuffix="%", range=[lo, min(100, float(trend["return_rate"].max() * 100) + 8)])
    _base(fig, height)
    return _axes(fig)


def status_donut(counts: dict, height=250):
    labels = ["AT RISK", "ACTIVE / NORMAL", "LOYAL"]
    keys = ["At Risk", "Active / Normal", "Loyal / High-Value"]
    vals = [counts.get(k, 0) for k in keys]
    total = sum(vals)
    fig = go.Figure(go.Pie(labels=labels, values=vals, hole=0.7, sort=False, direction="clockwise",
                           marker=dict(colors=[STATUS[k]["color"] for k in keys], line=dict(color="#fff", width=3)),
                           textinfo="none", hovertemplate="<b>%{label}</b><br>%{value:,} customers (%{percent})<extra></extra>"))
    fig.add_annotation(text=f"<b style='font-size:26px'>{total:,}</b><br><span style='color:{MUTED};font-size:12px'>scored</span>",
                       showarrow=False, x=0.5, y=0.5)
    return _base(fig, height, margin=dict(l=4, r=4, t=4, b=4))


# --------------------------------------------------------- customer detail
def order_rhythm(orders_c: pd.DataFrame, snapshot, status: str, usual_lo, usual_hi, currency="₹", last_n=14, height=250):
    """Timeline of one customer's orders, their expected next-order window and the current gap."""
    color = STATUS[status]["color"]
    d = orders_c.sort_values("order_date").tail(last_n)
    snap = pd.Timestamp(snapshot)
    last = d["order_date"].max()
    fig = go.Figure()
    # expected window after the last order
    if pd.notna(usual_lo) and pd.notna(usual_hi):
        x0 = last + pd.Timedelta(days=float(max(usual_lo, 1)))
        x1 = last + pd.Timedelta(days=float(max(usual_hi, usual_lo + 1)))
        fig.add_vrect(x0=x0, x1=x1, fillcolor="rgba(37,99,235,0.14)", line_width=0)
        fig.add_annotation(x=x0 + (x1 - x0) / 2, y=1, yref="paper", text="expected next order", showarrow=False,
                           font=dict(size=12, color=BLUE), yanchor="bottom")
    # current gap (last order -> analysis date)
    fig.add_trace(go.Scatter(x=[last, snap], y=[0, 0], mode="lines", line=dict(color=color, width=4, dash="dot"),
                             hoverinfo="skip", showlegend=False))
    fig.add_trace(go.Scatter(x=[snap], y=[0], mode="markers", marker=dict(size=13, color="#fff", line=dict(color=color, width=3)),
                             hovertemplate=f"<b>Analysis date</b><br>%{{x|%d %b %Y}}<extra></extra>", showlegend=False))
    amt = d["amount"].to_numpy(dtype=float)
    size = 9 + 14 * (amt - amt.min()) / (amt.max() - amt.min() + 1e-9)
    fig.add_trace(go.Scatter(x=d["order_date"], y=[0] * len(d), mode="lines+markers",
                             line=dict(color="#CBD5E1", width=2), marker=dict(size=size, color=BLUE, line=dict(color="#fff", width=2)),
                             customdata=amt, hovertemplate=f"<b>%{{x|%d %b %Y}}</b><br>Order value {currency}%{{customdata:,.0f}}<extra></extra>",
                             showlegend=False))
    fig.update_yaxes(visible=False, range=[-1, 1])
    _base(fig, height, margin=dict(l=8, r=8, t=26, b=8))
    return _axes(fig, grid_y=False)


def gap_history(gaps: pd.Series, current_gap: int, status: str, usual_lo, usual_hi, last_n=14, height=260):
    """Bars: days between this customer's past orders, plus the current gap, against their own usual range."""
    g = gaps.tail(last_n).tolist()
    labels = [f"#{i + 1}" for i in range(len(g))] + ["Now"]
    vals = g + [current_gap]
    colors = ["#93C5FD"] * len(g) + [STATUS[status]["color"]]
    fig = go.Figure(go.Bar(x=labels, y=vals, marker=dict(color=colors),
                           hovertemplate="%{y} days<extra></extra>", text=vals, textposition="outside",
                           textfont=dict(size=12, color=MUTED), cliponaxis=False))
    if pd.notna(usual_lo) and pd.notna(usual_hi):
        fig.add_hrect(y0=usual_lo, y1=max(usual_hi, usual_lo + 1), fillcolor="rgba(15,118,110,0.12)", line_width=0)
        fig.add_annotation(x=0, xref="paper", y=usual_hi, text="usual range", showarrow=False, xanchor="left",
                           yanchor="bottom", font=dict(size=12, color=TEAL))
    fig.update_yaxes(title_text="days between orders", title_font=dict(size=12, color=MUTED))
    _base(fig, height, margin=dict(l=8, r=8, t=18, b=8))
    return _axes(fig)


# --------------------------------------------------------------- insights
def hbar(df: pd.DataFrame, label: str, value: str, color=BLUE, height=260, fmt="{:,}"):
    d = df.iloc[::-1]
    fig = go.Figure(go.Bar(y=d[label], x=d[value], orientation="h", marker=dict(color=color),
                           text=[fmt.format(v) for v in d[value]], textposition="outside", cliponaxis=False,
                           hovertemplate="<b>%{y}</b><br>%{x:,} customers<extra></extra>"))
    fig.update_xaxes(visible=False)
    fig.update_yaxes(tickfont=dict(color=INK, size=13), showgrid=False)
    _base(fig, height, margin=dict(l=8, r=40, t=4, b=4))
    return fig


def status_value_heatmap(m: pd.DataFrame, height=260):
    z = m.values
    fig = go.Figure(go.Heatmap(z=z, x=[f"{c} value" for c in m.columns], y=[s.replace(" / High-Value", "").upper() for s in m.index],
                               colorscale=[[0, "#F1F5F9"], [1, "#2563EB"]], showscale=False, xgap=4, ygap=4,
                               text=z, texttemplate="%{text:,}", textfont=dict(size=15, color=INK),
                               hovertemplate="%{y} · %{x}<br>%{z:,} customers<extra></extra>"))
    fig.update_yaxes(autorange="reversed", tickfont=dict(size=12, color=INK))
    fig.update_xaxes(side="top", tickfont=dict(size=12, color=MUTED))
    return _base(fig, height, margin=dict(l=8, r=8, t=8, b=8))


def monthly_activity(m: pd.DataFrame, height=300):
    fig = go.Figure()
    fig.add_trace(go.Bar(x=m["month"], y=m["orders"], name="Orders", marker=dict(color="#BFDBFE"),
                         hovertemplate="%{x|%b %Y}<br>%{y:,} orders<extra></extra>"))
    fig.add_trace(go.Scatter(x=m["month"], y=m["active_customers"], name="Active customers", mode="lines+markers",
                             line=dict(color=BLUE, width=3), hovertemplate="%{x|%b %Y}<br>%{y:,} active customers<extra></extra>"))
    _base(fig, height, legend=True)
    fig.update_layout(legend=dict(orientation="h", y=1.12, x=0))
    return _axes(fig)


def segment_bars(prof: pd.DataFrame, height=280):
    d = prof.iloc[::-1]
    colors = {"Loyal": STATUS["Loyal / High-Value"]["color"], "Active": STATUS["Active / Normal"]["color"],
              "At Risk": STATUS["At Risk"]["color"], "High Value": BLUE, "Emerging / New": TEAL}
    fig = go.Figure(go.Bar(y=d["segment"], x=d["customers"], orientation="h", marker=dict(color=[colors[s] for s in d["segment"]]),
                           text=[f"{v:,}" for v in d["customers"]], textposition="outside", cliponaxis=False,
                           hovertemplate="<b>%{y}</b><br>%{x:,} customers<extra></extra>"))
    fig.update_xaxes(visible=False)
    fig.update_yaxes(showgrid=False, tickfont=dict(size=13, color=INK))
    return _base(fig, height, margin=dict(l=8, r=44, t=4, b=4))
