"""Tests for analytics, date handling, model fallback and the live-demo files."""
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd

from src import config
from src.analytics import (action_summary, at_risk_reasons, observed_return_trend, segment_profile)
from src.data_validation import parse_dates, validate
from src.prediction_pipeline import run_demo, run_pipeline


# ----------------------------------------------------------------- dates
def test_day_first_dates_detected_when_unambiguous():
    s = pd.Series(["25-03-2026", "02-04-2026", "13/05/2026"])
    d, note = parse_dates(s)
    assert d.iloc[0] == pd.Timestamp("2026-03-25") and d.iloc[1] == pd.Timestamp("2026-04-02")
    assert note is None


def test_ambiguous_dates_produce_a_warning():
    d, note = parse_dates(pd.Series(["05-03-2026", "06-03-2026", "07-04-2026"]))
    assert note and "ambiguous" in note


def test_iso_and_excel_dates_are_fine():
    d, note = parse_dates(pd.Series(["2026-03-05", "2026-04-07"]))
    assert note is None and d.notna().all()
    d2, _ = parse_dates(pd.Series(pd.to_datetime(["2026-03-05", "2026-04-07"])))
    assert d2.notna().all()


# ------------------------------------------------------------- analytics
def test_analytics_tables_are_consistent_with_customers():
    r = run_demo()
    a, c = r.analytics, r.customers
    assert sum(x["customers"] for x in a["status_distribution"]) == len(c)
    assert len(a["attention"]) <= 5 and (a["attention"]["status"] == "At Risk").all()
    tr = observed_return_trend(r.orders)
    assert {"snapshot", "customers", "returned", "return_rate"} <= set(tr.columns)
    assert tr["return_rate"].between(0, 1).all() and (tr["returned"] <= tr["customers"]).all()
    assert set(action_summary(c).columns) >= {"action_type", "customers", "high_priority"}
    assert set(at_risk_reasons(c).columns) >= {"reason", "customers"}
    assert len(segment_profile(c)) == 5
    dq = a["data_quality"]
    assert dq["rows_uploaded"] >= dq["rows_used"]
    assert dq["customers"] >= c["customer_id"].nunique()
    assert isinstance(a["insight"], str) and a["insight"]


def test_value_and_status_are_independent_columns():
    c = run_demo().customers
    both = c[(c["status"] == "At Risk") & (c["value_tier"] == "High")]
    assert len(both) > 0     # a high-value customer CAN be at risk (status and value are separate)


def test_reporting_exports_build():
    from src.reporting import build_excel, build_html_report
    r = run_demo()
    assert len(build_excel(r, r.analytics["return_trend"])) > 1000
    assert "Customer Behaviour" in build_html_report(r, r.analytics["return_trend"])


# -------------------------------------------------------------- model
def test_corrupt_model_file_is_rebuilt_automatically():
    with tempfile.TemporaryDirectory() as d:
        bad = Path(d) / "model.joblib"
        bad.write_bytes(b"not a model")
        r = run_pipeline(config.DEMO_DATA_PATH, model_path=bad, data_label="Synthetic Demo Data")
        assert r.ok
        assert any("rebuilt" in n for n in r.notes)
        assert bad.stat().st_size > 1000          # a fresh model was saved in its place


def test_model_can_be_reused_to_rerun_quickly():
    r1 = run_demo()
    r2 = run_pipeline(config.DEMO_DATA_PATH, model=r1.model, data_label="Synthetic Demo Data")
    assert np.allclose(r1.customers.sort_values("customer_id")["return_probability"].to_numpy(),
                       r2.customers.sort_values("customer_id")["return_probability"].to_numpy(), equal_nan=True)


# ------------------------------------------------------ live demo files
def _live(name):
    p = config.DATA_DIR / "live_demo" / name
    if not p.exists():
        import subprocess, sys
        subprocess.run([sys.executable, "-m", "scripts.make_live_demo_files"], check=True, cwd=config.ROOT)
    return p


def test_live_demo_story_customers_get_expected_status():
    r = run_pipeline(_live("live_demo_upload_synthetic.csv"), data_label="Uploaded dataset")
    c = r.customers.set_index("customer_id")
    assert r.ok
    assert c.loc["C001", "status"] == "At Risk"
    assert c.loc["C003", "status"] == "At Risk" and c.loc["C003", "value_tier"] == "High"
    assert c.loc["C002", "status"] == "Loyal / High-Value"
    assert c.loc["C004", "status"] == "Loyal / High-Value" and c.loc["C004", "value_tier"] == "Low"
    assert c.loc["C005", "status"] == "Not enough history"


def test_live_demo_xlsx_matches_csv():
    a = run_pipeline(_live("live_demo_upload_synthetic.csv"))
    b = run_pipeline(_live("live_demo_upload_synthetic.xlsx"))
    assert a.ok and b.ok and a.summary["total_customers"] == b.summary["total_customers"]


def test_live_demo_messy_file_gives_warnings_not_errors():
    r = run_pipeline(_live("live_demo_messy_synthetic.csv"))
    assert r.ok and len(r.validation.warnings) >= 3


def test_live_demo_error_files_give_friendly_messages():
    for name, text in (("live_demo_missing_column.csv", "Missing required column"),
                       ("live_demo_insufficient_history.csv", "Insufficient history")):
        r = run_pipeline(_live(name))
        assert not r.ok and any(text in e for e in r.validation.errors)
