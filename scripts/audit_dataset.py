"""Dataset audit (blueprint Phase 2). Usage:  python -m scripts.audit_dataset path/to/data.csv

Prints the checks needed to decide whether a dataset is suitable: repeat customers,
date range, missing values, duplicates, cancelled orders, whether a 30-day return
label can be built, and whether payment behaviour is available.
"""
from __future__ import annotations

import sys

import pandas as pd

from src import config
from src.data_cleaning import clean
from src.data_validation import validate_file
from src.label_creation import build_training_set


def audit(path) -> dict:
    df, res = validate_file(path)
    out = {"validation": res.as_dict()}
    if df is None:
        return out
    orders, rep = clean(df)
    per = orders.groupby("customer_id").size()
    out["cleaning"] = rep
    out["repeat_customer_share"] = float((per >= 2).mean())
    out["repeat_customers"] = int((per >= 2).sum())
    out["one_time_customers"] = int((per == 1).sum())
    out["orders_per_customer_median"] = float(per.median())
    out["orders_per_customer_p90"] = float(per.quantile(0.90))
    out["has_payment_method"] = "payment_method" in orders.columns
    out["has_category"] = "category" in orders.columns
    out["missing_values"] = {c: int(df[c].isna().sum()) for c in df.columns}
    try:
        ts = build_training_set(orders)
        out["label_feasible"] = not ts.empty
        if not ts.empty:
            out["snapshots"] = int(ts["snapshot"].nunique())
            out["training_rows"] = int(len(ts))
            out["return_rate"] = float(ts["return_30d"].mean())
            out["target_counts"] = {"no_return_30d": int((ts["return_30d"] == 0).sum()),
                                    "return_30d": int((ts["return_30d"] == 1).sum())}
            out["target_rows"] = int(len(ts))
    except Exception as exc:  # noqa: BLE001
        out["label_feasible"] = False
        out["label_error"] = str(exc)
    verdict = []
    if out["repeat_customer_share"] < 0.10:
        verdict.append("WEAK: fewer than 10% repeat customers - behaviour modelling will be limited.")
    if out["validation"]["stats"].get("history_days", 0) < config.MIN_HISTORY_DAYS_FOR_TRAINING:
        verdict.append("WEAK: history too short to train a time-based model.")
    if not out.get("label_feasible"):
        verdict.append("FAIL: a 30-day return label cannot be built.")
    elif out.get("return_rate", 0) < 0.05:
        verdict.append("WEAK: fewer than 5% of snapshot rows return within 30 days; expect severe class imbalance and limited retention signal.")
    elif out.get("return_rate", 1) > 0.95:
        verdict.append("WEAK: more than 95% of snapshot rows return within 30 days; target may have too little class variation.")
    if not out["has_payment_method"]:
        verdict.append("LIMITATION: payment_method is absent; do not claim payment-method behaviour was analysed.")
    out["verdict"] = verdict or ["OK: dataset looks suitable for further model evaluation; this is not yet proof of model quality."]
    return out


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    import json
    print(json.dumps(audit(sys.argv[1]), indent=2, default=str))
