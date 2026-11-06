"""Core tests. Run with:  pytest -q"""
import io
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd

from src import config
from src.customer_status import (STATUS_ACTIVE, STATUS_AT_RISK, STATUS_LOYAL, STATUS_NEW, assign_status)
from src.data_cleaning import clean
from src.data_validation import validate, validate_file
from src.demo_data import generate_demo_data
from src.feature_engineering import MODEL_FEATURES, build_features
from src.label_creation import build_training_set, create_labels, default_snapshots
from src.recommendation_engine import BusinessRules, recommend
from src.train_model import time_split


def _orders(rows):
    df = pd.DataFrame(rows, columns=["customer_id", "order_id", "order_date", "amount"])
    df["order_date"] = pd.to_datetime(df["order_date"])
    return df


# ---------------------------------------------------------------- validation
def test_missing_required_column_message_is_human_readable():
    df = pd.DataFrame({"order_id": [1], "order_date": ["2025-01-01"], "amount": [10]})
    out, res = validate(df)
    assert out is None and not res.is_valid
    assert "Missing required column: customer_id" in res.errors


def test_column_aliases_are_recognised():
    demo = generate_demo_data(n_customers=60, seed=1)
    alt = demo.rename(columns={"customer_id": "Customer Unique ID", "order_date": "Order Purchase Timestamp",
                               "amount": "Payment Value", "order_id": "Order ID"})
    out, res = validate(alt)
    assert res.is_valid, res.errors
    assert {"customer_id", "order_date", "amount", "order_id"} <= set(out.columns)


def test_unsupported_and_corrupt_files_do_not_raise():
    f = io.BytesIO(b"hello"); f.name = "data.txt"
    out, res = validate_file(f)
    assert out is None and "Unsupported file format" in res.errors[0]
    g = io.BytesIO(b"\x00\x01\x02garbage"); g.name = "data.xlsx"
    out, res = validate_file(g)
    assert out is None and res.errors


def test_insufficient_history_detected():
    rows = [(f"C{i}", f"O{i}", "2025-01-01", 100) for i in range(20)]   # one order each
    out, res = validate(pd.DataFrame(rows, columns=["customer_id", "order_id", "order_date", "amount"]))
    assert out is None and any("Insufficient history" in e for e in res.errors)


# ------------------------------------------------------------------ cleaning
def test_cleaning_removes_bad_rows_and_duplicates():
    df = pd.DataFrame({
        "customer_id": ["A", "A", "A", "B", "", "B"],
        "order_id": ["1", "1", "2", "3", "4", "5"],
        "order_date": ["2025-01-01", "2025-01-01", "bad-date", "2025-01-03", "2025-01-04", "2025-01-09"],
        "amount": [10, 10, 20, -5, 30, 50],
        "order_status": ["ok", "ok", "ok", "ok", "ok", "Cancelled"]})
    out, rep = clean(df)
    assert len(out) == 1 and out.iloc[0]["order_id"] == "1"
    assert rep["removed_duplicates"] == 1 and rep["removed_invalid_date"] == 1
    assert rep["removed_invalid_amount"] == 1 and rep["removed_cancelled_orders"] == 1


def test_split_payment_lines_merge_into_one_order():
    df = pd.DataFrame({"customer_id": ["A", "A"], "order_id": ["1", "1x"], "order_date": ["2025-01-01"] * 2,
                       "amount": [10, 5]})
    out, _ = clean(df)
    assert len(out) == 2   # different order ids stay different


# ----------------------------------------------- features / labels / leakage
def _toy():
    return _orders([("A", "1", "2025-01-01", 100), ("A", "2", "2025-01-11", 200), ("A", "3", "2025-01-21", 300),
                    ("A", "4", "2025-02-05", 400),                      # future relative to 2025-01-31
                    ("B", "5", "2025-01-02", 50), ("B", "6", "2025-01-20", 70)])


def test_features_never_use_future_orders():
    o = _toy()
    T = "2025-01-31"
    with_future = build_features(o, T)
    without_future = build_features(o[o["order_date"] <= T], T)
    pd.testing.assert_frame_equal(with_future, without_future)
    assert with_future.loc["A", "frequency"] == 3          # the 5 Feb order is invisible
    assert with_future.loc["A", "recency_days"] == 10


def test_label_is_future_window_only():
    o = _toy()
    y = create_labels(o, "2025-01-31", 30)
    assert y["A"] == 1                                       # ordered on 5 Feb (within 30 days)
    assert y["B"] == 0
    assert create_labels(o, "2025-01-31", 3)["A"] == 0       # 5 Feb is outside a 3-day window


def test_training_set_labels_match_manual_check():
    o, _ = clean(validate(generate_demo_data(n_customers=150, seed=3))[0])
    ts = build_training_set(o)
    row = ts.iloc[len(ts) // 2]
    T = row["snapshot"]
    future = o[(o.customer_id == row["customer_id"]) & (o.order_date > T) &
               (o.order_date <= T + pd.Timedelta(days=30))]
    assert int(len(future) > 0) == row["return_30d"]


def test_last_snapshot_has_full_label_window():
    o, _ = clean(validate(generate_demo_data(n_customers=100, seed=4))[0])
    snaps = default_snapshots(o)
    assert snaps[-1] + pd.Timedelta(days=30) <= o["order_date"].max()


def test_time_split_is_chronological_without_overlap():
    o, _ = clean(validate(generate_demo_data(n_customers=200, seed=5))[0])
    tr, va, te, _ = time_split(build_training_set(o))
    assert tr["snapshot"].max() < va["snapshot"].min() <= va["snapshot"].max() < te["snapshot"].min()
    # label window of the last train snapshot must end before/at the first validation snapshot
    assert tr["snapshot"].max() + pd.Timedelta(days=30) <= va["snapshot"].min()


# ----------------------------------------------------------- status / recs
def _row(**kw):
    base = dict(avg_order_value=900.0, usual_order_interval=12.0, overdue_ratio=2.0, frequency_trend=-0.5,
                favourite_category="Groceries", recency_days=24)
    base.update(kw)
    return pd.Series(base)


def test_status_thresholds():
    df = pd.DataFrame({"frequency": [10, 10, 10], "active_months": [6, 6, 6], "overdue_ratio": [0.5, 0.5, 0.5]})
    s = assign_status(df, np.array([0.1, 0.6, 0.95]), {"at_risk": 0.4, "loyal": 0.9})
    assert list(s) == [STATUS_AT_RISK, STATUS_ACTIVE, STATUS_LOYAL]


def test_offer_scales_with_customer_value_not_flat():
    low = recommend(_row(avg_order_value=300.0), STATUS_AT_RISK, "Low", lapsed=True)
    high = recommend(_row(avg_order_value=5000.0), STATUS_AT_RISK, "High")
    assert high["offer_value"] > low["offer_value"]
    assert high["action_type"] != low["action_type"]


def test_business_rules_cap_discount():
    r = recommend(_row(avg_order_value=1000.0), STATUS_AT_RISK, "High", rules=BusinessRules(max_discount_pct=8))
    assert r["offer_value"] <= 1000 * 0.08


def test_rounded_discount_never_exceeds_cap_for_small_order_values():
    aov = 20.0
    cap = aov * 0.15
    result = recommend(
        _row(avg_order_value=aov), STATUS_AT_RISK, "High", lapsed=True,
        rules=BusinessRules(max_discount_pct=15.0),
    )
    assert result["action_type"] == "Win-back offer"
    assert result["offer_value"] is not None
    assert result["offer_value"] <= cap


def test_slightly_overdue_at_risk_customer_gets_reminder_not_offer():
    result = recommend(_row(overdue_ratio=1.2), STATUS_AT_RISK, "High")
    assert result["action_type"] == "Timed reminder"
    assert result["offer_value"] is None


def test_no_discount_mode_does_not_offer_points_or_monetary_value():
    result = recommend(_row(), STATUS_AT_RISK, "High", rules=BusinessRules(allow_discounts=False))
    assert result["offer_value"] is None
    assert "loyalty points" not in result["recommended_action"].lower()
    assert "discount" not in result["recommended_action"].lower()


def test_non_at_risk_statuses_do_not_receive_discount_or_unconfigured_points():
    for status in (STATUS_ACTIVE, STATUS_LOYAL, STATUS_NEW):
        result = recommend(_row(), status, "High")
        assert result["offer_value"] is None
        assert "loyalty points" not in result["recommended_action"].lower()


def test_missing_average_order_value_does_not_create_offer():
    result = recommend(_row(avg_order_value=float("nan")), STATUS_AT_RISK, "High", lapsed=True)
    assert result["offer_value"] is None
    assert result["action_type"] == "Win-back message"


def test_loyal_customers_do_not_get_discounts():
    for tier in ("High", "Medium", "Low"):
        assert recommend(_row(overdue_ratio=0.5), STATUS_LOYAL, tier)["offer_value"] is None


def test_no_discount_mode():
    r = recommend(_row(), STATUS_AT_RISK, "High", rules=BusinessRules(allow_discounts=False))
    assert "%" not in r["recommended_action"]       # no percentage discount when discounts are disabled


# --------------------------------------------------------------- pipeline
def test_pipeline_demo_and_upload_use_same_path():
    from src.prediction_pipeline import run_pipeline, run_demo, customer_detail
    if not Path(config.MODEL_PATH).exists():
        import subprocess, sys
        subprocess.run([sys.executable, "-m", "src.train_model"], check=True, cwd=config.ROOT)
    demo = run_demo()
    assert demo.ok and demo.summary["total_customers"] > 0
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "upload.csv"
        pd.read_csv(config.DEMO_DATA_PATH).to_csv(p, index=False)
        up = run_pipeline(p, data_label="Uploaded")
    a = demo.customers.sort_values("customer_id")["return_probability"].to_numpy()
    b = up.customers.sort_values("customer_id")["return_probability"].to_numpy()
    assert np.allclose(a, b, equal_nan=True)
    cid = demo.customers.iloc[0]["customer_id"]
    det = customer_detail(demo, cid)
    assert det["why"] and det["recommended_action"]


def test_pipeline_bad_upload_returns_friendly_errors():
    from src.prediction_pipeline import run_pipeline
    bad = pd.DataFrame({"foo": [1, 2], "bar": [3, 4]})
    res = run_pipeline(bad)
    assert not res.ok and res.validation.errors
    assert all("Traceback" not in e for e in res.validation.errors)


def test_probabilities_between_0_and_1_and_all_statuses_valid():
    from src.prediction_pipeline import run_demo
    c = run_demo().customers
    scored = c["return_probability"].dropna()
    assert scored.between(0, 1).all()
    assert set(c["status"]) <= {"At Risk", "Active / Normal", "Loyal / High-Value", "Not enough history"}
    assert (c["why"].str.len() > 0).all()
