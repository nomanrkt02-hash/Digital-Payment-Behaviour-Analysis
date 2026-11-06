"""Target creation: did the customer order again within the next 30 days?

Return = 1  if the customer has a qualifying order in (snapshot, snapshot + horizon]
Return = 0  otherwise.
The label looks into the FUTURE; features (feature_engineering) look only at the PAST.
"""
from __future__ import annotations

import pandas as pd

from . import config
from .feature_engineering import build_features


def create_labels(orders: pd.DataFrame, snapshot, horizon_days: int | None = None) -> pd.Series:
    """Return a 0/1 Series (index = customer_id) for every customer in `orders`."""
    horizon_days = horizon_days or config.RETURN_HORIZON_DAYS
    T = pd.Timestamp(snapshot).normalize()
    end = T + pd.Timedelta(days=horizon_days)
    future = orders[(orders["order_date"] > T) & (orders["order_date"] <= end)]
    returned = set(future["customer_id"].unique())
    ids = orders["customer_id"].unique()
    return pd.Series({c: int(c in returned) for c in ids}, name="return_30d")


def default_snapshots(orders: pd.DataFrame, horizon_days: int | None = None,
                      step_days: int | None = None, warmup_days: int = 90) -> list[pd.Timestamp]:
    """Snapshots spaced `step_days` apart. The last one leaves a FULL horizon of
    observed future, so labels are never based on an incomplete window."""
    horizon_days = horizon_days or config.RETURN_HORIZON_DAYS
    step_days = step_days or config.SNAPSHOT_STEP_DAYS
    first = orders["order_date"].min() + pd.Timedelta(days=warmup_days)
    last = orders["order_date"].max() - pd.Timedelta(days=horizon_days)
    snaps, t = [], last
    while t >= first:                       # walk backwards so the latest window is complete
        snaps.append(t.normalize())
        t -= pd.Timedelta(days=step_days)
    return sorted(snaps)


def build_training_set(orders: pd.DataFrame, snapshots: list | None = None,
                       horizon_days: int | None = None) -> pd.DataFrame:
    """Stack (features at snapshot, label after snapshot) for many snapshots.

    Columns: customer_id, snapshot, <features...>, return_30d
    """
    horizon_days = horizon_days or config.RETURN_HORIZON_DAYS
    snapshots = snapshots or default_snapshots(orders, horizon_days)
    parts = []
    for T in snapshots:
        feats = build_features(orders, T)
        if feats.empty:
            continue
        y = create_labels(orders, T, horizon_days).reindex(feats.index).fillna(0).astype(int)
        part = feats.copy()
        part["snapshot"] = pd.Timestamp(T)
        part["return_30d"] = y.values
        parts.append(part.reset_index(names="customer_id"))
    if not parts:
        return pd.DataFrame()
    return pd.concat(parts, ignore_index=True)
