"""Session state + the only places where the UI calls the backend."""
from __future__ import annotations

import streamlit as st

from src.analytics import observed_return_trend
from src.demo_data import ensure_demo_data
from src.prediction_pipeline import PipelineResult, run_pipeline
from src.recommendation_engine import BusinessRules

DEFAULT_RULES = {"currency_symbol": "₹", "max_discount_pct": 15.0, "allow_discounts": True}

DEFAULTS = {
    "page": "welcome", "welcome_mode": "choose", "result": None, "raw_df": None, "data_label": "",
    "is_demo": False, "trend": None, "selected_customer": None, "rules": dict(DEFAULT_RULES),
    "retrain_on_upload": False, "default_sort": "Priority (highest first)", "segment": "At Risk",
    "upload_cache": None, "customer_back": "customers",
}


def init() -> None:
    for k, v in DEFAULTS.items():
        if k not in st.session_state:
            st.session_state[k] = v if not isinstance(v, dict) else dict(v)


def goto(page: str) -> None:
    st.session_state.page = page


def open_customer(cid: str, back: str = "customers") -> None:
    st.session_state.selected_customer = str(cid)
    st.session_state.customer_back = back
    st.session_state.page = "customer_detail"


def rules() -> BusinessRules:
    return BusinessRules(**st.session_state.rules)


def currency() -> str:
    return st.session_state.rules.get("currency_symbol", "₹")


def result() -> PipelineResult | None:
    return st.session_state.result


def has_data() -> bool:
    r = st.session_state.result
    return r is not None and r.ok


def _set(res: PipelineResult, raw, label: str, demo: bool) -> None:
    st.session_state.result = res
    st.session_state.raw_df = raw
    st.session_state.data_label = label
    st.session_state.is_demo = demo
    st.session_state.trend = None
    st.session_state.selected_customer = None
    st.session_state.segment = "At Risk"


def load_demo() -> PipelineResult:
    raw = ensure_demo_data()
    res = run_pipeline(raw, data_label="Synthetic Demo Data", rules=rules())
    if res.ok:
        _set(res, raw, "Synthetic Demo Data", True)
    return res


def load_upload(raw, name: str, retrain: bool) -> PipelineResult:
    res = run_pipeline(raw, retrain=retrain, data_label=f"Uploaded: {name}", rules=rules())
    if res.ok:
        _set(res, raw, f"Uploaded: {name}", False)
    return res


def recompute() -> PipelineResult:
    """Re-run on the current dataset (e.g. after changing business rules). Re-uses the fitted model."""
    old = st.session_state.result
    res = run_pipeline(st.session_state.raw_df, model=old.model if old else None,
                       data_label=st.session_state.data_label, rules=rules())
    if res.ok:
        st.session_state.result = res
    return res


def ensure_trend():
    if st.session_state.trend is None and has_data():
        st.session_state.trend = observed_return_trend(st.session_state.result.orders)
    return st.session_state.trend


def reset_dataset() -> None:
    for k in ("result", "raw_df", "trend", "selected_customer", "upload_cache"):
        st.session_state[k] = None
    st.session_state.page = "welcome"
    st.session_state.welcome_mode = "choose"
