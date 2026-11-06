"""Legacy Streamlit backend smoke-test.

The merged production UI is the React app in frontend/ and the FastAPI service in api.py.
Use START_PROJECT.bat on Windows or follow README.md. This file is retained for quick backend checks only.
"""
import streamlit as st

from src.prediction_pipeline import run_demo

st.set_page_config(page_title="Digital Payment Behaviour Analysis", page_icon="🔒")
st.title("Digital Payment Behaviour Analysis")
st.caption("Backend smoke test - the full UI is not built yet.")

if st.button("Run backend on Synthetic Demo Data"):
    res = run_demo()
    if res.ok:
        st.success("Backend pipeline works.")
        st.json(res.summary)
        st.dataframe(res.customers[["customer_id", "return_probability_pct", "status", "value_tier",
                                     "why", "recommended_action"]].head(25))
    else:
        st.error("; ".join(res.validation.errors))
