"""End-to-end pipeline. Demo data and uploaded data use EXACTLY the same path:

    load -> validate -> clean -> features -> saved model -> probability
         -> status -> value tier -> why -> recommended action
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from . import config
from .analytics import build_analytics
from .customer_status import (PRIORITY_RANK, STATUS_AT_RISK, STATUS_EMOJI, STATUS_NEW, STATUS_RANK,
                              STATUS_SUMMARY, assign_status, build_why, is_lapsed, short_reason, trend_label,
                              value_tier)
from .data_cleaning import clean
from .data_validation import ValidationResult, load_file, validate
from .feature_engineering import MODEL_FEATURES, build_features
from .recommendation_engine import BusinessRules, recommend_all
from .train_model import ensure_model, train_from_orders


@dataclass
class PipelineResult:
    ok: bool
    validation: ValidationResult
    cleaning_report: dict = field(default_factory=dict)
    customers: pd.DataFrame | None = None      # one row per customer (see COLUMNS in docs/UI_INTEGRATION.md)
    orders: pd.DataFrame | None = None         # cleaned transactions
    summary: dict = field(default_factory=dict)
    model_info: dict = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)
    snapshot_date: pd.Timestamp | None = None
    analytics: dict = field(default_factory=dict)   # dashboard-ready tables (see src/analytics.py)
    model: object = None                       # fitted ReturnModel (reuse it to re-run quickly)


def _read_source(source) -> tuple[pd.DataFrame | None, ValidationResult]:
    if isinstance(source, pd.DataFrame):
        return source.copy(), ValidationResult()
    return load_file(source)


def run_pipeline(source, model_path=config.MODEL_PATH, retrain: bool = False,
                 rules: BusinessRules | None = None, data_label: str | None = None,
                 snapshot_date=None, model=None, strict_retrain: bool = False, fast_mode: bool = False) -> PipelineResult:
    """Run everything. `source` = path | file-like (Streamlit upload) | DataFrame.

    retrain=True trains a fresh model on the uploaded data itself when it has enough history
    (recommended for real datasets); otherwise the saved model is used.
    """
    raw, load_res = _read_source(source)
    if raw is None:
        return PipelineResult(False, load_res)
    df, val = validate(raw)
    val.warnings = load_res.warnings + val.warnings
    if df is None:
        return PipelineResult(False, val)

    orders, cleaning_report = clean(df)
    notes: list[str] = []
    snapshot = pd.Timestamp(snapshot_date).normalize() if snapshot_date is not None else orders["order_date"].max()

    # ---- model: saved (default) or trained on this data
    model_source = ""
    if model is not None:
        model_source = "Trained on the uploaded dataset" if "Synthetic" not in str(model.metadata.get("data_label", "")) else "Saved model (trained on Synthetic Demo Data)"
    elif retrain:
        if val.stats.get("history_days", 0) >= config.MIN_HISTORY_DAYS_FOR_TRAINING:
            try:
                model, training_report = train_from_orders(
                    orders, data_label=data_label or "Uploaded dataset", verbose=False,
                    fast_mode=fast_mode,
                    report_dir=(config.REPORTS_DIR / "latest_upload") if strict_retrain else None,
                )
                model.metadata["evaluation"] = training_report
                model_source = "Trained on the uploaded dataset"
            except ValueError as exc:
                notes.append(f"Could not train on this dataset ({exc}). The saved model was used instead.")
        else:
            notes.append("Not enough history to train on this dataset; the saved model was used instead.")
    if model is None and retrain and strict_retrain:
        val.errors.append(
            "A reliable model could not be trained from this dataset. The system will not silently use "
            "the synthetic demo model for uploaded data. Check history length, repeat-customer coverage, "
            "and whether a valid time-based training/test split can be built."
        )
        return PipelineResult(False, val, cleaning_report=cleaning_report, notes=notes)

    if model is None:
        model = ensure_model(model_path)
        if model.metadata.get("rebuilt"):
            notes.append("The saved model was rebuilt for this computer's library versions (one-time step).")
        model_source = "Saved model (trained on Synthetic Demo Data)" \
            if "Synthetic" in str(model.metadata.get("data_label", "")) else "Saved model"
        if "Synthetic" in model_source:
            notes.append("Predictions use a model trained on synthetic demo data; patterns in your data may "
                         "differ. Use retrain=True for a model fitted to your own history.")

    # ---- features -> prediction
    feats = build_features(orders, snapshot, min_orders=1)
    enough = feats["frequency"] >= config.MIN_ORDERS_FOR_PREDICTION
    pred = feats[enough].copy()
    if pred.empty:
        val.errors.append("Insufficient history: no customer has enough orders to predict.")
        return PipelineResult(False, val)

    probs = model.predict_proba(pred)
    pred["return_probability"] = probs
    pred["status"] = assign_status(pred, probs, model.thresholds)
    pred["is_lapsed"] = is_lapsed(pred)
    pred["value_tier"] = value_tier(pred)

    # customers with a single order: reported, but not scored
    new = feats[~enough].copy()
    new["return_probability"] = np.nan
    new["status"] = STATUS_NEW
    new["is_lapsed"] = False
    new["value_tier"] = "Low"
    new["usual_order_interval"] = new["usual_order_interval"].fillna(30.0)
    new["overdue_ratio"] = new["overdue_ratio"].fillna(0.0)
    cust = pd.concat([pred, new]) if len(new) else pred

    rules = rules or BusinessRules()
    cust["frequency_trend_label"] = cust["frequency_trend"].map(trend_label)
    cust["spending_trend_label"] = cust["spending_trend"].map(trend_label)
    cust["why_list"] = [build_why(r, r["status"], bool(r["is_lapsed"]), rules.currency_symbol)
                        if r["status"] != STATUS_NEW else ["Only one order so far"] for _, r in cust.iterrows()]
    cust["why"] = cust["why_list"].map(lambda xs: "; ".join(xs))
    cust["short_reason"] = [short_reason(r, r["status"], bool(r["is_lapsed"])) for _, r in cust.iterrows()]
    cust["status_summary"] = cust["status"].map(STATUS_SUMMARY)
    cust["status_emoji"] = cust["status"].map(STATUS_EMOJI)
    cust = cust.join(recommend_all(cust, rules))
    cust["return_probability_pct"] = (cust["return_probability"] * 100).round(0)
    cust = cust.reset_index(names="customer_id")
    cust["priority_rank"] = cust["priority"].map(PRIORITY_RANK)
    cust["status_rank"] = cust["status"].map(STATUS_RANK)
    cust = cust.sort_values(["status_rank", "priority_rank", "return_probability"],
                            na_position="last").reset_index(drop=True)

    counts = cust["status"].value_counts().to_dict()
    scored = cust[cust["status"] != STATUS_NEW]
    summary = {
        "total_customers": int(len(cust)),
        "at_risk": int(counts.get("At Risk", 0)),
        "active": int(counts.get("Active / Normal", 0)),
        "loyal": int(counts.get("Loyal / High-Value", 0)),
        "not_enough_history": int(counts.get(STATUS_NEW, 0)),
        "avg_return_probability": float(scored["return_probability"].mean()),
        "at_risk_high_value": int(((cust["status"] == "At Risk") & (cust["value_tier"] == "High")).sum()),
        "total_orders": int(len(orders)),
        "date_min": str(orders["order_date"].min().date()),
        "date_max": str(orders["order_date"].max().date()),
        "snapshot_date": str(snapshot.date()),
        "data_label": data_label or "",
    }
    evaluation = model.metadata.get("evaluation")
    model_info = {"source": model_source, "model_name": model.metadata.get("selected_model"),
                  "trained_on": model.metadata.get("data_label"), "thresholds": model.thresholds,
                  "horizon_days": config.RETURN_HORIZON_DAYS,
                  "test_metrics": evaluation.get("test_metrics") if isinstance(evaluation, dict) else None,
                  "validation_metrics": evaluation.get("validation_metrics") if isinstance(evaluation, dict) else None,
                  "evaluation_note": evaluation.get("note") if isinstance(evaluation, dict) else None}
    analytics = build_analytics(cust, orders, df, cleaning_report, val)
    return PipelineResult(True, val, cleaning_report, cust, orders, summary, model_info, notes,
                          snapshot_date=snapshot, analytics=analytics, model=model)


def run_demo(rules: BusinessRules | None = None, **kw) -> PipelineResult:
    """'Explore Demo Data' button. Same pipeline as an upload; clearly labelled synthetic."""
    from .demo_data import ensure_demo_data
    return run_pipeline(ensure_demo_data(), rules=rules, data_label="Synthetic Demo Data", **kw)


def customer_detail(result: PipelineResult, customer_id: str) -> dict:
    """Everything the Customer Detail page shows, for one customer."""
    row = result.customers[result.customers["customer_id"] == str(customer_id)]
    if row.empty:
        raise KeyError(f"Unknown customer_id: {customer_id}")
    r = row.iloc[0]
    hist = result.orders[result.orders["customer_id"] == str(customer_id)].sort_values("order_date")
    lo, hi = r["usual_interval_low"], r["usual_interval_high"]
    interval_txt = (f"{round(lo)}–{round(hi)} days" if pd.notna(lo) and pd.notna(hi) and round(hi) > round(lo)
                    else f"~{round(r['usual_order_interval'])} days")
    return {
        "customer_id": str(customer_id),
        "return_probability_pct": r["return_probability_pct"],
        "status": r["status"], "status_emoji": r["status_emoji"], "status_summary": r["status_summary"],
        "value_tier": r["value_tier"], "is_lapsed": bool(r["is_lapsed"]),
        "typical_order_interval": interval_txt,
        "current_inactivity_days": int(r["recency_days"]),
        "average_order_value": float(r["avg_order_value"]),
        "total_spend": float(r["total_spend"]), "orders": int(r["frequency"]),
        "frequency_trend": r["frequency_trend_label"], "spending_trend": r["spending_trend_label"],
        "favourite_category": r["favourite_category"], "favourite_payment_method": r["favourite_payment_method"],
        "why": r["why_list"],
        "recommended_action": r["recommended_action"], "action_type": r["action_type"],
        "priority": r["priority"], "offer_value": r["offer_value"],
        "short_reason": r["short_reason"],
        "order_history": hist,
        # data for a "rhythm strip" visual: past orders, usual-gap band, where the next order was expected
        "order_dates": [d.date().isoformat() for d in hist["order_date"]],
        "usual_interval_low_days": None if pd.isna(lo) else float(lo),
        "usual_interval_high_days": None if pd.isna(hi) else float(hi),
        "last_order_date": pd.Timestamp(r["last_order_date"]).date().isoformat(),
        "expected_next_order_from": None if pd.isna(lo) else (pd.Timestamp(r["last_order_date"]) + pd.Timedelta(days=round(lo))).date().isoformat(),
        "expected_next_order_until": None if pd.isna(hi) else (pd.Timestamp(r["last_order_date"]) + pd.Timedelta(days=round(hi))).date().isoformat(),
        "days_past_usual_window": None if pd.isna(hi) else int(max(0, r["recency_days"] - round(hi))),
        "snapshot_date": result.snapshot_date.date().isoformat(),
    }
