"""HTTP API connecting the Digital Payment Behaviour Analysis UI to the retention backend.

Run from the project root with: uvicorn api:app --host 127.0.0.1 --port 8000
"""
from __future__ import annotations

import math
import os
from datetime import date, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware

from src.prediction_pipeline import PipelineResult, customer_detail, run_demo, run_pipeline
from src.recommendation_engine import BusinessRules, recommend_all

app = FastAPI(title="Digital Payment Behaviour Analysis API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "DPBA_ALLOWED_ORIGINS",
        "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
    ).split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
_CURRENT: PipelineResult | None = None
_DEMO_PREVIEW: PipelineResult | None = None

class RulesPayload(BaseModel):
    currency: str = Field(default="₹", min_length=1, max_length=4)
    max_discount: float = Field(default=15.0, ge=0.0, le=100.0)
    allow_discounts: bool = True



def _safe(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return None if not math.isfinite(float(value)) else float(value)
    if isinstance(value, (pd.Timestamp, datetime, date)):
        return value.isoformat()[:10] if isinstance(value, (pd.Timestamp, date)) else value.isoformat()
    if pd.isna(value) if not isinstance(value, (list, tuple, dict, set)) else False:
        return None
    if isinstance(value, dict):
        return {str(k): _safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set, np.ndarray, pd.Series)):
        return [_safe(v) for v in list(value)]
    return str(value) if not isinstance(value, (str, int, float, bool)) else value


def _records(df: pd.DataFrame | None, date_columns: tuple[str, ...] = ()) -> list[dict]:
    if df is None or df.empty:
        return []
    out = df.copy()
    for c in date_columns:
        if c in out.columns:
            def fmt_date(value):
                if value is None or pd.isna(value):
                    return None
                try:
                    return pd.Timestamp(value).strftime("%Y-%m-%d")
                except (TypeError, ValueError):
                    return None
            out[c] = out[c].map(fmt_date)
    return [_safe(r) for r in out.to_dict(orient="records")]


def _serialize(result: PipelineResult) -> dict:
    if not result.ok or result.customers is None or result.orders is None:
        return {
            "ok": False,
            "validation": {
                "is_valid": False,
                "errors": list(result.validation.errors),
                "warnings": list(result.validation.warnings),
                "stats": _safe(result.validation.stats),
                "column_map": _safe(result.validation.column_map),
            },
            "notes": result.notes,
        }

    customers: list[dict] = []
    for _, row in result.customers.iterrows():
        c = {k: _safe(v) for k, v in row.to_dict().items()}
        c["why"] = _safe(row.get("why_list", []))
        c["why_list"] = _safe(row.get("why_list", []))
        c["return_probability"] = _safe(row.get("return_probability"))
        c["total_order_count"] = _safe(row.get("frequency"))
        c["frequency"] = _safe(row.get("orders_per_30d"))
        hist = result.orders[result.orders["customer_id"].astype(str) == str(row["customer_id"])]
        c["order_dates"] = pd.to_datetime(hist["order_date"]).dt.strftime("%Y-%m-%d").tolist()
        customers.append(c)

    a = result.analytics or {}
    status_dist = _records(pd.DataFrame(a.get("status_distribution", [])))
    for item in status_dist:
        item["share"] = round(float(item.get("share") or 0) * 100, 1)
    value_dist = _records(pd.DataFrame(a.get("value_distribution", [])))
    for item in value_dist:
        item["share"] = round(float(item.get("share") or 0) * 100, 1)
    reasons = _records(pd.DataFrame(a.get("reasons", [])))
    for item in reasons:
        item["share_of_at_risk"] = round(float(item.get("share_of_at_risk") or 0) * 100, 1)
    segments = _records(a.get("segments")) if isinstance(a.get("segments"), pd.DataFrame) else []
    for item in segments:
        item["share"] = round(float(item.get("share") or 0) * 100, 1)
    trend = _records(a.get("return_trend"), ("snapshot",))
    for item in trend:
        item["snapshot"] = str(item.get("snapshot", ""))[:7]
    monthly = _records(a.get("monthly_activity"), ("month",))
    for item in monthly:
        item["month"] = str(item.get("month", ""))[:7]

    analytics = {
        "status_distribution": status_dist,
        "value_distribution": value_dist,
        "attention": _records(a.get("attention")),
        "reasons": reasons,
        "actions": _records(a.get("actions")),
        "behaviour_changes": _safe(a.get("behaviour_changes", {})),
        "segments": segments,
        "return_trend": trend,
        "monthly_activity": monthly,
        "data_quality": _safe(a.get("data_quality", {})),
        "insight": str(a.get("insight", "")),
    }
    orders = _records(result.orders, ("order_date",))
    validation = {
        "is_valid": True,
        "errors": list(result.validation.errors),
        "warnings": list(result.validation.warnings),
        "stats": _safe(result.validation.stats),
        "column_map": _safe(result.validation.column_map),
    }
    summary = _safe(result.summary)
    detail = {
        "order_dates": [],
        "snapshot_date": summary.get("snapshot_date"),
        "days_past_usual_window": 0,
    }
    if customers:
        first = customers[0]
        detail["order_dates"] = first.get("order_dates", [])
        detail["customer_id"] = first.get("customer_id")
    return {
        "ok": True,
        "summary": summary,
        "customers": customers,
        "orders": orders,
        "analytics": analytics,
        "validation": validation,
        "cleaning_report": _safe(result.cleaning_report),
        "model_info": _safe(result.model_info),
        "notes": list(result.notes),
        "customer_detail": detail,
    }


@app.get("/api/health")
def health():
    return {"ok": True, "service": "Digital Payment Behaviour Analysis", "has_current_result": _CURRENT is not None}


@app.get("/api/current")
def current():
    if _CURRENT is None:
        return {"ok": False, "message": "No dataset has been processed yet."}
    return _serialize(_CURRENT)


@app.get("/api/preview")
def preview():
    """Return compact, data-derived welcome-page analytics without loading the dashboard."""
    global _DEMO_PREVIEW
    result = _CURRENT
    if result is None:
        if _DEMO_PREVIEW is None:
            _DEMO_PREVIEW = run_demo()
        result = _DEMO_PREVIEW
    if not result.ok or result.customers is None:
        raise HTTPException(status_code=503, detail="A product preview is not available.")

    analytics = result.analytics or {}
    status_distribution = _records(pd.DataFrame(analytics.get("status_distribution", [])))
    for item in status_distribution:
        item["share"] = round(float(item.get("share") or 0) * 100, 1)
    reasons = _records(pd.DataFrame(analytics.get("reasons", [])))
    actions = _records(pd.DataFrame(analytics.get("actions", [])))
    risk_example = None
    if reasons:
        leading_action = actions[0] if actions else {"action_type": "Review customer behaviour", "customers": 0}
        risk_example = {
            "reason": reasons[0]["reason"],
            "reason_customers": reasons[0]["customers"],
            "suggested_action": leading_action["action_type"],
            "action_customers": leading_action["customers"],
        }
    return {
        "ok": True,
        "summary": _safe(result.summary),
        "status_distribution": status_distribution,
        "risk_example": risk_example,
    }


@app.post("/api/demo")
def demo():
    global _CURRENT, _DEMO_PREVIEW
    result = _DEMO_PREVIEW or run_demo()
    _DEMO_PREVIEW = None
    if not result.ok:
        raise HTTPException(status_code=422, detail={"errors": result.validation.errors, "warnings": result.validation.warnings})
    _CURRENT = result
    return _serialize(result)


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    global _CURRENT
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".csv", ".xlsx"}:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload a CSV or XLSX file.")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File is larger than 25 MB. Please upload a smaller file.")
    from io import BytesIO
    class NamedBytesIO(BytesIO):
        def __init__(self, content: bytes, name: str):
            super().__init__(content)
            self.name = name
    label = f"Uploaded dataset: {file.filename}"
    result = run_pipeline(NamedBytesIO(raw, file.filename or "upload.csv"), retrain=True, strict_retrain=True, fast_mode=True, data_label=label)
    if not result.ok:
        raise HTTPException(status_code=422, detail={"errors": result.validation.errors, "warnings": result.validation.warnings, "stats": _safe(result.validation.stats), "notes": result.notes})
    _CURRENT = result
    return _serialize(result)


@app.post("/api/settings")
def update_settings(payload: RulesPayload):
    """Apply business-rule settings to the currently loaded customer results.

    Model predictions do not change; only the separate recommendation layer is recalculated.
    """
    global _CURRENT
    if _CURRENT is None or _CURRENT.customers is None:
        raise HTTPException(status_code=409, detail="Load Demo Data or upload a dataset first.")
    rules = BusinessRules(
        currency_symbol=payload.currency,
        max_discount_pct=payload.max_discount,
        allow_discounts=payload.allow_discounts,
    )
    recs = recommend_all(_CURRENT.customers, rules)
    for col in ["action_type", "recommended_action", "offer_value", "priority"]:
        _CURRENT.customers[col] = recs[col]
    return _serialize(_CURRENT)


@app.get("/api/customer/{customer_id}")
def customer(customer_id: str):
    if _CURRENT is None:
        raise HTTPException(status_code=409, detail="Load Demo Data or upload a dataset first.")
    try:
        detail = customer_detail(_CURRENT, customer_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Customer not found in the active dataset.")
    detail = dict(detail)
    if isinstance(detail.get("order_history"), pd.DataFrame):
        detail["order_history"] = _records(detail["order_history"], ("order_date",))
    return _safe(detail)
