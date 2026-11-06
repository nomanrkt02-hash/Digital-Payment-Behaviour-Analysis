"""Export helpers: Excel workbook and a printable HTML summary."""
from __future__ import annotations

import html
import io

import pandas as pd

from .analytics import action_summary, at_risk_reasons, segment_profile

CUSTOMER_EXPORT_COLUMNS = [
    "customer_id", "status", "value_tier", "return_probability_pct", "priority", "action_type",
    "recommended_action", "why", "recency_days", "usual_order_interval", "avg_order_value", "total_spend",
    "frequency", "active_months", "frequency_trend_label", "spending_trend_label", "favourite_category",
    "favourite_payment_method", "last_order_date",
]


def customers_export(customers: pd.DataFrame) -> pd.DataFrame:
    cols = [c for c in CUSTOMER_EXPORT_COLUMNS if c in customers.columns]
    out = customers[cols].copy()
    for c in ("last_order_date",):
        if c in out:
            out[c] = pd.to_datetime(out[c]).dt.date
    return out


def build_excel(result, trend: pd.DataFrame | None = None) -> bytes:
    c = result.customers
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as xw:
        pd.DataFrame(list(result.summary.items()), columns=["item", "value"]).to_excel(xw, sheet_name="Summary", index=False)
        customers_export(c).to_excel(xw, sheet_name="Customers", index=False)
        customers_export(c[c["status"] == "At Risk"]).to_excel(xw, sheet_name="At-risk action list", index=False)
        segment_profile(c).to_excel(xw, sheet_name="Segments", index=False)
        at_risk_reasons(c).to_excel(xw, sheet_name="At-risk reasons", index=False)
        action_summary(c).to_excel(xw, sheet_name="Actions", index=False)
        if trend is not None and len(trend):
            trend.to_excel(xw, sheet_name="Return trend", index=False)
    return buf.getvalue()


def build_html_report(result, trend: pd.DataFrame | None = None) -> str:
    s, c = result.summary, result.customers
    e = html.escape
    rows = "".join(f"<tr><td>{e(str(r.reason))}</td><td>{r.customers}</td></tr>" for r in at_risk_reasons(c).itertuples())
    acts = "".join(f"<tr><td>{e(str(r.action_type))}</td><td>{r.customers}</td><td>{r.high_priority}</td></tr>"
                   for r in action_summary(c).itertuples())
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>Customer Retention Report</title>
<style>body{{font-family:Inter,Arial,sans-serif;max-width:860px;margin:32px auto;color:#172033}}
h1{{font-size:26px}}h2{{font-size:18px;margin-top:28px}}table{{border-collapse:collapse;width:100%}}
td,th{{border-bottom:1px solid #E2E8F0;padding:8px;text-align:left}}.k{{display:inline-block;margin:0 24px 12px 0}}
.k b{{display:block;font-size:26px}}.note{{color:#64748B;font-size:13px}}</style></head><body>
<h1>Customer Behaviour &amp; Retention Report</h1>
<p class="note">Dataset: {e(s.get('data_label') or 'Uploaded dataset')} · {e(s['date_min'])} to {e(s['date_max'])} ·
Analysis date {e(s['snapshot_date'])}</p>
<div><span class="k"><b>{s['total_customers']:,}</b>Customers analysed</span>
<span class="k"><b>{s['at_risk']:,}</b>At risk</span><span class="k"><b>{s['active']:,}</b>Active / Normal</span>
<span class="k"><b>{s['loyal']:,}</b>Loyal</span></div>
<h2>Why customers are at risk</h2><table><tr><th>Behaviour</th><th>Customers</th></tr>{rows}</table>
<h2>Recommended actions (at-risk customers)</h2>
<table><tr><th>Action</th><th>Customers</th><th>High priority</th></tr>{acts}</table>
<p class="note">Return likelihood comes from a prediction model; recommended actions come from separate business rules.
{e(' '.join(result.notes))}</p></body></html>"""
