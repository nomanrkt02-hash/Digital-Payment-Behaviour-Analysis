"""Data cleaning. Every decision is logged in the returned report."""
from __future__ import annotations

import pandas as pd

from . import config
from .data_validation import parse_dates


def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Clean a standardised dataframe -> (clean orders, cleaning report).

    Output columns: customer_id (str), order_id (str), order_date (datetime,
    normalised to the day), amount (float) and, when present, category,
    payment_method.
    """
    report: dict = {"rows_in": int(len(df))}
    out = df.copy()

    out["customer_id"] = out["customer_id"].astype("string").str.strip()
    out = out[out["customer_id"].notna() & (out["customer_id"] != "")]
    report["removed_empty_customer_id"] = report["rows_in"] - len(out)

    n = len(out)
    out["order_date"], _ = parse_dates(out["order_date"])
    out = out[out["order_date"].notna()]
    if out["order_date"].dt.tz is not None:
        out["order_date"] = out["order_date"].dt.tz_localize(None)
    out["order_date"] = out["order_date"].dt.normalize()   # day-level precision
    report["removed_invalid_date"] = n - len(out)

    n = len(out)
    out["amount"] = pd.to_numeric(out["amount"], errors="coerce")
    out = out[out["amount"].notna() & (out["amount"] > 0)]
    report["removed_invalid_amount"] = n - len(out)

    if "order_status" in out.columns:
        n = len(out)
        st = out["order_status"].astype("string").str.strip().str.lower()
        out = out[~st.isin(config.EXCLUDED_STATUSES)]
        report["removed_cancelled_orders"] = n - len(out)

    n = len(out)
    out["order_id"] = out["order_id"].astype("string")
    out = out.drop_duplicates(subset=["customer_id", "order_id"], keep="first")
    report["removed_duplicates"] = n - len(out)

    # Several payment lines of the same order (e.g. split payments) -> one order
    n = len(out)
    agg = {"order_date": "min", "amount": "sum"}
    for c in ("category", "payment_method"):
        if c in out.columns:
            agg[c] = "first"
    out = out.groupby(["customer_id", "order_id"], as_index=False).agg(agg)
    report["merged_split_order_lines"] = n - len(out)

    # Text columns: tidy, fill unknown
    for c in ("category", "payment_method"):
        if c in out.columns:
            out[c] = out[c].astype("string").str.strip().fillna("Unknown").astype(str)

    out["customer_id"] = out["customer_id"].astype(str)
    out["order_id"] = out["order_id"].astype(str)
    out = out.sort_values(["customer_id", "order_date", "order_id"]).reset_index(drop=True)
    report["rows_out"] = int(len(out))
    report["customers"] = int(out["customer_id"].nunique())
    return out, report
