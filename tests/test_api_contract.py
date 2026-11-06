"""API serialization checks for values consumed by the React dashboard."""

from collections import Counter

import api
import pandas as pd
from src.prediction_pipeline import run_demo


def test_welcome_preview_and_dashboard_payload_share_pipeline_values(monkeypatch):
    result = run_demo()
    monkeypatch.setattr(api, "_CURRENT", None)
    monkeypatch.setattr(api, "_DEMO_PREVIEW", result)

    preview = api.preview()
    dashboard = api._serialize(result)

    assert preview["ok"] is True
    assert preview["summary"]["total_customers"] == dashboard["summary"]["total_customers"]
    assert preview["summary"]["total_orders"] == len(dashboard["orders"])
    assert preview["summary"]["date_min"] == min(order["order_date"] for order in dashboard["orders"])
    assert preview["summary"]["date_max"] == max(order["order_date"] for order in dashboard["orders"])
    assert sum(row["customers"] for row in preview["status_distribution"]) == len(dashboard["customers"])
    assert sum(row["customers"] for row in dashboard["analytics"]["status_distribution"]) == len(dashboard["customers"])
    assert dashboard["model_info"]["horizon_days"] == 30
    status_counts = Counter(row["status"] for row in dashboard["customers"])
    assert dashboard["summary"]["at_risk"] == status_counts["At Risk"]
    assert dashboard["summary"]["active"] == status_counts["Active / Normal"]
    assert dashboard["summary"]["loyal"] == status_counts["Loyal / High-Value"]
    assert dashboard["summary"]["not_enough_history"] == status_counts["Not enough history"]
    assert {row["status"]: row["customers"] for row in dashboard["analytics"]["status_distribution"]} == dict(status_counts)

    serialized_customers = {row["customer_id"]: row for row in dashboard["customers"]}
    for _, source_customer in result.customers.iterrows():
        serialized = serialized_customers[source_customer["customer_id"]]
        assert serialized["why"] == source_customer["why_list"]
        assert serialized["action_type"] == source_customer["action_type"]
        assert serialized["recommended_action"] == source_customer["recommended_action"]

    reasons = dashboard["analytics"]["reasons"]
    actions = dashboard["analytics"]["actions"]
    sample = preview["risk_example"]
    assert sample is not None
    assert sample["reason"] == reasons[0]["reason"]
    assert sample["reason_customers"] == reasons[0]["customers"]
    assert sample["suggested_action"] == actions[0]["action_type"]
    assert sample["action_customers"] == actions[0]["customers"]
    assert "customer_id" not in sample

    for customer in dashboard["customers"]:
        probability = customer["return_probability"]
        expected_pct = None if probability is None else round(probability * 100)
        assert customer["return_probability_pct"] == expected_pct
        assert customer["why"]
        assert customer["recommended_action"]


def test_customer_recency_matches_last_order_to_snapshot_gap():
    result = run_demo()
    customers = result.customers
    snapshot = result.summary["snapshot_date"]
    gaps = (pd.Timestamp(snapshot) - customers["last_order_date"]).dt.days
    assert (gaps == customers["recency_days"]).all()


def test_uploaded_csv_endpoint_processes_real_file_contract():
    """The upload API must return its cleaned transaction counts and trained model metadata."""
    import asyncio
    from io import BytesIO
    from pathlib import Path
    from starlette.datastructures import UploadFile

    path = Path(api.__file__).parent / "data" / "live_demo" / "live_demo_upload_synthetic.csv"
    file = UploadFile(filename=path.name, file=BytesIO(path.read_bytes()))
    payload = asyncio.run(api.analyze(file))
    assert payload["ok"] is True
    assert payload["summary"]["total_customers"] == len(payload["customers"])
    assert payload["summary"]["total_orders"] == len(payload["orders"])
    assert payload["analytics"]["data_quality"]["rows_used"] == len(payload["orders"])
    assert payload["summary"]["date_min"] == min(row["order_date"] for row in payload["orders"])
    assert payload["summary"]["date_max"] == max(row["order_date"] for row in payload["orders"])
    assert payload["model_info"]["source"] == "Trained on the uploaded dataset"
