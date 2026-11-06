"""Customer-level behavioural features.

LEAKAGE RULE: features for a prediction point `snapshot` use ONLY orders with
order_date <= snapshot. Nothing after the snapshot is ever read.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config

# Numeric features given to the ML model
MODEL_FEATURES = [
    "recency_days",              # days since last order
    "frequency",                 # total orders so far
    "usual_order_interval",      # median gap between orders (days)
    "interval_std",              # variability of gaps
    "overdue_ratio",             # recency / usual interval  (>1 = later than usual)
    "recent_order_count_30",     # orders in last 30 days
    "recent_order_count_90",     # orders in last 90 days
    "historical_order_count",    # orders before the last 90 days
    "avg_order_value",
    "recent_aov_ratio",          # AOV of last 90 days / own overall AOV
    "frequency_trend",           # -1 (fading) .. +1 (accelerating)
    "spending_trend",            # -1 (fading) .. +1 (accelerating)
    "active_months",             # distinct calendar months with an order
    "tenure_days",               # days since first order
    "orders_per_30d",            # average orders per 30 days of tenure
    "behaviour_consistency",     # 1 = very regular, 0 = erratic
]

# Extra descriptive columns (used for explanations / recommendations, not by the model)
INFO_COLUMNS = ["last_order_date", "first_order_date", "total_spend", "usual_interval_low",
                "usual_interval_high", "monthly_spend", "favourite_category",
                "favourite_payment_method"]


def _trend(recent: pd.Series, previous: pd.Series) -> pd.Series:
    tot = recent + previous
    return ((recent - previous) / tot.where(tot > 0)).fillna(0.0)


def build_features(orders: pd.DataFrame, snapshot, min_orders: int | None = None) -> pd.DataFrame:
    """Build one row per customer, as known at `snapshot`.

    Parameters
    ----------
    orders : cleaned orders (customer_id, order_id, order_date, amount, ...)
    snapshot : prediction point (date-like). Only order_date <= snapshot is used.
    min_orders : customers with fewer orders before the snapshot are dropped
                 (default: config.MIN_ORDERS_FOR_PREDICTION). Pass 1 to keep all.
    """
    min_orders = config.MIN_ORDERS_FOR_PREDICTION if min_orders is None else min_orders
    T = pd.Timestamp(snapshot).normalize()
    h = orders[orders["order_date"] <= T].copy()           # <-- the only data access
    if h.empty:
        return pd.DataFrame(columns=["customer_id", *MODEL_FEATURES, *INFO_COLUMNS]).set_index("customer_id")
    h = h.sort_values(["customer_id", "order_date"])
    h["gap"] = h.groupby("customer_id")["order_date"].diff().dt.days
    h["age"] = (T - h["order_date"]).dt.days                # days before snapshot
    h["month"] = h["order_date"].dt.to_period("M")

    g = h.groupby("customer_id")
    f = pd.DataFrame(index=g.size().index)
    f["frequency"] = g.size()
    f["first_order_date"] = g["order_date"].min()
    f["last_order_date"] = g["order_date"].max()
    f["recency_days"] = (T - f["last_order_date"]).dt.days
    f["tenure_days"] = (T - f["first_order_date"]).dt.days
    f["total_spend"] = g["amount"].sum()
    f["avg_order_value"] = g["amount"].mean()

    gaps = h.dropna(subset=["gap"])
    gg = gaps.groupby("customer_id")["gap"]
    f["usual_order_interval"] = gg.median().reindex(f.index)
    f["interval_std"] = gg.std().reindex(f.index)
    f["usual_interval_low"] = gg.quantile(0.25).reindex(f.index)
    f["usual_interval_high"] = gg.quantile(0.75).reindex(f.index)
    # customers with a single order: fall back to tenure-based guess (kept only if min_orders==1)
    f["usual_order_interval"] = f["usual_order_interval"].clip(lower=1)
    f["interval_std"] = f["interval_std"].fillna(0.0)

    def count_between(lo: int, hi: int) -> pd.Series:      # orders with lo <= age < hi
        m = (h["age"] >= lo) & (h["age"] < hi)
        return h[m].groupby("customer_id").size().reindex(f.index).fillna(0)

    def spend_between(lo: int, hi: int) -> pd.Series:
        m = (h["age"] >= lo) & (h["age"] < hi)
        return h[m].groupby("customer_id")["amount"].sum().reindex(f.index).fillna(0.0)

    f["recent_order_count_30"] = count_between(0, 30)
    f["recent_order_count_90"] = count_between(0, 90)
    f["historical_order_count"] = f["frequency"] - f["recent_order_count_90"]
    f["frequency_trend"] = _trend(count_between(0, 60), count_between(60, 120))
    f["spending_trend"] = _trend(spend_between(0, 90), spend_between(90, 180))

    rec_spend90 = spend_between(0, 90)
    rec_cnt90 = f["recent_order_count_90"]
    rec_aov = (rec_spend90 / rec_cnt90.where(rec_cnt90 > 0))
    f["recent_aov_ratio"] = (rec_aov / f["avg_order_value"]).fillna(0.0)

    f["active_months"] = g["month"].nunique()
    f["orders_per_30d"] = f["frequency"] / np.maximum(f["tenure_days"] / 30.0, 1.0)
    f["monthly_spend"] = f["total_spend"] / np.maximum(f["tenure_days"] / 30.0, 1.0)
    f["overdue_ratio"] = f["recency_days"] / f["usual_order_interval"]
    cv = (f["interval_std"] / f["usual_order_interval"]).fillna(0.0)
    f["behaviour_consistency"] = 1.0 / (1.0 + cv)

    # descriptive favourites (optional columns)
    for src, dst in (("category", "favourite_category"), ("payment_method", "favourite_payment_method")):
        if src in h.columns:
            fav = h.groupby(["customer_id", src]).size().reset_index(name="n")
            fav = fav.sort_values(["customer_id", "n", src], ascending=[True, False, True])
            f[dst] = fav.drop_duplicates("customer_id").set_index("customer_id")[src].reindex(f.index)
        else:
            f[dst] = None

    f = f[f["frequency"] >= min_orders]
    f = f.replace([np.inf, -np.inf], np.nan)
    return f[[*MODEL_FEATURES, *INFO_COLUMNS]]
