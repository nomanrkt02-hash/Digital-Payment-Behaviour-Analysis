"""Dashboard analytics derived from the pipeline output (all numbers are REAL, computed from the data).

Nothing here is a prediction. `return_trend` is an OBSERVED history; the only predicted
quantity in the product is `return_probability`, produced by the ML model.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config
from .customer_status import (STATUS_ACTIVE, STATUS_AT_RISK, STATUS_LOYAL, STATUS_NEW, trend_label)
from .label_creation import default_snapshots

STATUS_ORDER = [STATUS_AT_RISK, STATUS_ACTIVE, STATUS_LOYAL, STATUS_NEW]


def status_distribution(cust: pd.DataFrame) -> list[dict]:
    vc, total = cust["status"].value_counts(), max(len(cust), 1)
    return [{"status": s, "customers": int(vc.get(s, 0)), "share": float(vc.get(s, 0) / total)}
            for s in STATUS_ORDER]


def value_distribution(cust: pd.DataFrame) -> list[dict]:
    vc, total = cust["value_tier"].value_counts(), max(len(cust), 1)
    return [{"value_tier": t, "customers": int(vc.get(t, 0)), "share": float(vc.get(t, 0) / total)}
            for t in ("High", "Medium", "Low")]


def attention_list(cust: pd.DataFrame, n: int = 5) -> pd.DataFrame:
    """At-risk customers worth acting on first: still recoverable (not lapsed), highest priority,
    lowest return likelihood."""
    d = cust[cust["status"] == STATUS_AT_RISK].sort_values(
        ["is_lapsed", "priority_rank", "return_probability"])
    return d.head(n)[["customer_id", "status", "short_reason", "priority", "value_tier",
                      "return_probability_pct", "recency_days", "usual_order_interval"]].reset_index(drop=True)


def reason_breakdown(cust: pd.DataFrame) -> list[dict]:
    """Main behavioural reasons among At Risk customers (a customer can have several)."""
    a = cust[cust["status"] == STATUS_AT_RISK]
    n = len(a)
    if n == 0:
        return []
    flags = {
        "Order gap much longer than usual": a["overdue_ratio"] >= 1.5,
        "Ordering frequency has decreased": a["frequency_trend"] < -0.2,
        "Spending has decreased": a["spending_trend"] < -0.2,
        "Order value is shrinking": (a["recent_order_count_90"] > 0) & (a["recent_aov_ratio"] < 0.8),
        "Inactive for a very long time (lapsed)": a["is_lapsed"],
    }
    out = [{"reason": k, "customers": int(v.sum()), "share_of_at_risk": float(v.mean())} for k, v in flags.items()]
    return sorted(out, key=lambda r: -r["customers"])


def action_breakdown(cust: pd.DataFrame) -> pd.DataFrame:
    a = cust[cust["status"] == STATUS_AT_RISK]
    if a.empty:
        return pd.DataFrame(columns=["action_type", "customers", "high_priority"])
    g = a.groupby("action_type").agg(customers=("customer_id", "size"),
                                     high_priority=("priority", lambda s: int((s == "High").sum())))
    return g.reset_index().sort_values("customers", ascending=False).reset_index(drop=True)


def behaviour_changes(cust: pd.DataFrame) -> dict:
    s = cust[cust["status"] != STATUS_NEW]
    f = s["frequency_trend"].map(trend_label).value_counts()
    sp = s["spending_trend"].map(trend_label).value_counts()
    return {
        "frequency": {k: int(f.get(k, 0)) for k in ("Decreasing", "Stable", "Increasing")},
        "spending": {k: int(sp.get(k, 0)) for k in ("Decreasing", "Stable", "Increasing")},
        "past_usual_interval": int((s["overdue_ratio"] > 1.0).sum()),
        "far_past_usual_interval": int((s["overdue_ratio"] >= 1.5).sum()),
    }


def segment_profiles(cust: pd.DataFrame) -> pd.DataFrame:
    """Segments. NOTE: they overlap on purpose - retention status and customer value are separate
    concepts (e.g. a customer can be both At Risk and High Value)."""
    scored = cust[cust["status"] != STATUS_NEW]
    defs = [
        ("Loyal", "retention", cust["status"] == STATUS_LOYAL),
        ("Active / Normal", "retention", cust["status"] == STATUS_ACTIVE),
        ("At Risk", "retention", cust["status"] == STATUS_AT_RISK),
        ("High Value", "value", cust["value_tier"] == "High"),
        ("Emerging / New", "emerging", (cust["tenure_days"] <= 60) | (cust["status"] == STATUS_NEW)),
    ]
    rows = []
    for name, kind, mask in defs:
        d = cust[mask]
        rows.append({
            "segment": name, "kind": kind, "customers": int(len(d)),
            "share": float(len(d) / max(len(cust), 1)),
            "avg_order_value": float(d["avg_order_value"].mean()) if len(d) else np.nan,
            "avg_usual_interval_days": float(d["usual_order_interval"].mean()) if len(d) else np.nan,
            "avg_days_since_last_order": float(d["recency_days"].mean()) if len(d) else np.nan,
            "avg_orders_per_30d": float(d["orders_per_30d"].mean()) if len(d) else np.nan,
            "avg_return_probability_pct": float(d["return_probability_pct"].mean())
            if len(d) and d["return_probability_pct"].notna().any() else np.nan,
        })
    return pd.DataFrame(rows)


def return_trend(orders: pd.DataFrame, horizon_days: int | None = None, base_days: int = 60) -> pd.DataFrame:
    """OBSERVED history: of the customers who ordered in the `base_days` before a date, what share
    ordered again within the next 30 days? One row per snapshot (about monthly)."""
    horizon_days = horizon_days or config.RETURN_HORIZON_DAYS
    snaps = default_snapshots(orders, horizon_days, warmup_days=base_days)
    rows = []
    for T in snaps:
        base = set(orders.loc[(orders["order_date"] > T - pd.Timedelta(days=base_days)) &
                              (orders["order_date"] <= T), "customer_id"])
        if not base:
            continue
        ret = set(orders.loc[(orders["order_date"] > T) &
                             (orders["order_date"] <= T + pd.Timedelta(days=horizon_days)), "customer_id"]) & base
        rows.append({"snapshot": pd.Timestamp(T), "customers": len(base), "returned": len(ret),
                     "return_rate": len(ret) / len(base)})
    return pd.DataFrame(rows, columns=["snapshot", "customers", "returned", "return_rate"])


def observed_return_trend(orders: pd.DataFrame) -> pd.DataFrame:
    """Name used by ui/state.py. Columns: snapshot, customers, returned, return_rate (all observed)."""
    return return_trend(orders)


def at_risk_reasons(cust: pd.DataFrame) -> pd.DataFrame:
    """DataFrame form of reason_breakdown (used by src/reporting.py)."""
    return pd.DataFrame(reason_breakdown(cust), columns=["reason", "customers", "share_of_at_risk"])


def action_summary(cust: pd.DataFrame) -> pd.DataFrame:
    """Used by src/reporting.py. Columns: action_type, customers, high_priority."""
    return action_breakdown(cust)


def segment_profile(cust: pd.DataFrame) -> pd.DataFrame:
    """Used by src/reporting.py."""
    return segment_profiles(cust)


def monthly_activity(orders: pd.DataFrame) -> pd.DataFrame:
    m = orders.assign(month=orders["order_date"].dt.to_period("M").dt.to_timestamp())
    g = m.groupby("month").agg(orders=("order_id", "size"), active_customers=("customer_id", "nunique"),
                               revenue=("amount", "sum")).reset_index()
    return g


def data_quality(raw_std: pd.DataFrame, cleaning_report: dict, validation, orders: pd.DataFrame) -> dict:
    missing = {str(c): int(v) for c, v in raw_std.isna().sum().items()}
    warnings_n = len(validation.warnings)
    return {
        "rows_uploaded": int(len(raw_std)),
        "rows_used": int(len(orders)),
        "customers": int(orders["customer_id"].nunique()),
        "date_min": str(orders["order_date"].min().date()),
        "date_max": str(orders["order_date"].max().date()),
        "missing_values": missing,
        "total_missing": int(sum(missing.values())),
        "duplicates_removed": int(cleaning_report.get("removed_duplicates", 0)),
        "cancelled_removed": int(cleaning_report.get("removed_cancelled_orders", 0)),
        "invalid_removed": int(cleaning_report.get("removed_invalid_date", 0)
                               + cleaning_report.get("removed_invalid_amount", 0)
                               + cleaning_report.get("removed_empty_customer_id", 0)),
        "available_columns": [str(c) for c in raw_std.columns],
        "has_amount": "amount" in raw_std.columns,
        "has_category": "category" in raw_std.columns,
        "has_payment_method": "payment_method" in raw_std.columns,
        "quality_status": "Good" if warnings_n == 0 else "Usable - review warnings",
        "warnings": list(validation.warnings),
    }


def insight_text(cust: pd.DataFrame) -> str:
    """Dynamic sentence for the 'Behavioural Insight' card - built from real counts."""
    a = cust[cust["status"] == STATUS_AT_RISK]
    if a.empty:
        return "No customers currently show a weakening ordering pattern."
    gap = int((a["overdue_ratio"] >= 1.5).sum())
    recoverable = int((~a["is_lapsed"]).sum())
    return (f"{gap} of {len(a)} at-risk customers are at least 1.5x past their usual ordering interval. "
            f"{recoverable} of them have not lapsed yet, so timely personalised engagement may still "
            f"bring them back.")


def build_analytics(cust: pd.DataFrame, orders: pd.DataFrame, raw_std: pd.DataFrame,
                    cleaning_report: dict, validation) -> dict:
    return {
        "status_distribution": status_distribution(cust),
        "value_distribution": value_distribution(cust),
        "attention": attention_list(cust, 5),
        "reasons": reason_breakdown(cust),
        "actions": action_breakdown(cust),
        "behaviour_changes": behaviour_changes(cust),
        "segments": segment_profiles(cust),
        "return_trend": return_trend(orders),
        "monthly_activity": monthly_activity(orders),
        "data_quality": data_quality(raw_std, cleaning_report, validation, orders),
        "insight": insight_text(cust),
    }
