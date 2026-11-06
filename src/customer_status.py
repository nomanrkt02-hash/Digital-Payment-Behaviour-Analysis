"""Customer status + customer value logic (separate from the ML model).

* Return likelihood  -> comes from the ML model.
* Status             -> At Risk / Active / Loyal (return likelihood + behaviour).
* Value tier         -> High / Medium / Low, a SEPARATE column. A low spender can be loyal;
                        a high spender can be at risk, so the two are never merged.
* Why                -> short explanation generated from the customer's real features.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

STATUS_AT_RISK = "At Risk"
STATUS_ACTIVE = "Active / Normal"
STATUS_LOYAL = "Loyal / High-Value"
STATUS_NEW = "Not enough history"

LAPSED_MIN_DAYS = 90          # no order for this long AND >4x the usual interval -> "Lapsed"
LAPSED_INTERVAL_MULT = 4.0

STATUS_EMOJI = {STATUS_AT_RISK: "🔴", STATUS_ACTIVE: "🟡", STATUS_LOYAL: "🟢", STATUS_NEW: "⚪"}

STATUS_SUMMARY = {
    STATUS_AT_RISK: "This customer is ordering less often than usual.",
    STATUS_ACTIVE: "This customer is following their usual ordering pattern.",
    STATUS_LOYAL: "This customer is consistently active and loyal.",
    STATUS_NEW: "This customer has too few orders to judge their behaviour yet.",
}


def assign_status(df: pd.DataFrame, probs: np.ndarray, thresholds: dict) -> pd.Series:
    p = np.asarray(probs)
    loyal_profile = ((df["frequency"] >= 4) & (df["active_months"] >= 3) & (df["overdue_ratio"] <= 1.5)).to_numpy()
    status = np.where(p < thresholds["at_risk"], STATUS_AT_RISK,
                      np.where((p >= thresholds["loyal"]) & loyal_profile, STATUS_LOYAL, STATUS_ACTIVE))
    return pd.Series(status, index=df.index, name="status")


def is_lapsed(df: pd.DataFrame) -> pd.Series:
    return ((df["recency_days"] >= LAPSED_MIN_DAYS) &
            (df["overdue_ratio"] >= LAPSED_INTERVAL_MULT)).rename("is_lapsed")


def value_tier(df: pd.DataFrame) -> pd.Series:
    """Value tier from monthly spend, relative to the customers in THIS dataset
    (top 20% High, bottom 40% Low). Independent of return likelihood."""
    ms = df["monthly_spend"]
    if len(ms) < 5:
        return pd.Series("Medium", index=df.index, name="value_tier")
    hi, lo = ms.quantile(0.80), ms.quantile(0.40)
    tier = np.where(ms >= hi, "High", np.where(ms <= lo, "Low", "Medium"))
    return pd.Series(tier, index=df.index, name="value_tier")


def trend_label(x: float, tol: float = 0.2) -> str:
    if x is None or np.isnan(x):
        return "Stable"
    return "Decreasing" if x < -tol else ("Increasing" if x > tol else "Stable")


def _fmt_money(v: float, symbol: str) -> str:
    return f"{symbol}{v:,.0f}"


def build_why(row: pd.Series, status: str, lapsed: bool = False, symbol: str = "₹") -> list[str]:
    """Bullet-point reasons built ONLY from this customer's actual numbers."""
    why = []
    lo, hi = row.get("usual_interval_low"), row.get("usual_interval_high")
    usual = row["usual_order_interval"]
    if pd.notna(lo) and pd.notna(hi) and round(hi) > round(lo):
        why.append(f"Usually orders every {round(lo)}–{round(hi)} days")
    else:
        why.append(f"Usually orders every ~{round(usual)} days")
    rec = int(row["recency_days"])
    why.append("Ordered today" if rec == 0 else f"{rec} days since last order")
    if row["overdue_ratio"] >= 1.5:
        why.append(f"That is about {row['overdue_ratio']:.1f}× longer than their usual gap")
    elif row["overdue_ratio"] <= 0.8 and status != STATUS_AT_RISK:
        why.append("Still within their usual ordering gap")
    ft = trend_label(row["frequency_trend"])
    if ft == "Decreasing":
        why.append("Recent order frequency has decreased")
    elif ft == "Increasing":
        why.append("Recent order frequency has increased")
    st = trend_label(row["spending_trend"])
    if st == "Decreasing":
        why.append("Recent spending has decreased")
    elif st == "Increasing":
        why.append("Recent spending has increased")
    if status == STATUS_LOYAL:
        why.append(f"{int(row['frequency'])} orders across {int(row['active_months'])} different months")
    if lapsed:
        why.append("No order for a long time - this customer may already be lost")
    return why


STATUS_RANK = {STATUS_AT_RISK: 0, STATUS_ACTIVE: 1, STATUS_LOYAL: 2, STATUS_NEW: 3}
PRIORITY_RANK = {"High": 0, "Medium": 1, "Low": 2}


def short_reason(row: pd.Series, status: str, lapsed: bool = False) -> str:
    """One plain-English line for lists/tables (the longer bullets come from build_why)."""
    if status == STATUS_NEW:
        return "Only one order so far - too early to judge."
    if status == STATUS_AT_RISK:
        if lapsed:
            return "No order for a very long time compared with their usual pattern."
        if row["overdue_ratio"] >= 1.5:
            return "Current order gap is much longer than usual."
        if trend_label(row["frequency_trend"]) == "Decreasing":
            return "Recent ordering frequency has decreased."
        if row["overdue_ratio"] > 1.0:
            return "Customer has exceeded their usual ordering interval."
        if trend_label(row["spending_trend"]) == "Decreasing":
            return "Recent spending has decreased."
        return "Ordering pattern has weakened compared with their own history."
    if status == STATUS_LOYAL:
        return "Consistently active across many months."
    if trend_label(row["frequency_trend"]) == "Decreasing":
        return "Ordering a little less often recently."
    return "Following their usual ordering pattern."
