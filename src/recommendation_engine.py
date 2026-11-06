"""Rule-based recommendation layer.

This is NOT a second ML model. It combines:
    ML return likelihood + customer behaviour + customer value + business rules
and outputs a customer-specific action. Offer sizes scale with the customer's own
average order value, so a small spender and a big spender never get the same flat discount.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .customer_status import (STATUS_ACTIVE, STATUS_AT_RISK, STATUS_LOYAL, STATUS_NEW, trend_label)


@dataclass
class BusinessRules:
    currency_symbol: str = "₹"
    max_discount_pct: float = 15.0        # business margin constraint
    min_discount_pct: float = 5.0
    allow_discounts: bool = True          # False -> messages and reminders; no reward program is configured
    round_to: int = 5                     # round offer values to nearest N currency units


def _round(v: float, to: int) -> float:
    if not np.isfinite(v) or v <= 0:
        return 0.0
    return float(max(0, round(v / to) * to))


def _pct(tier: str, rules: BusinessRules, lapsed: bool) -> float:
    base = {"Low": 6.0, "Medium": 10.0, "High": 14.0}[tier] + (2.0 if lapsed else 0.0)
    return float(min(rules.max_discount_pct, max(rules.min_discount_pct, base)))


def recommend(row: pd.Series, status: str, tier: str, lapsed: bool = False,
              rules: BusinessRules | None = None) -> dict:
    """Return {action_type, recommended_action, offer_value, priority} for one customer."""
    rules = rules or BusinessRules()
    sym = rules.currency_symbol
    try:
        aov = float(row.get("avg_order_value"))
    except (TypeError, ValueError):
        aov = float("nan")
    fav = row.get("favourite_category")
    fav_txt = f" on {fav}" if isinstance(fav, str) and fav not in ("", "Unknown") else ""
    interval_value = row.get("usual_order_interval")
    interval = int(round(float(interval_value))) if pd.notna(interval_value) and float(interval_value) > 0 else None
    overdue_ratio = row.get("overdue_ratio", 0.0)
    overdue_ratio = float(overdue_ratio) if pd.notna(overdue_ratio) else 0.0
    ftrend = trend_label(row.get("frequency_trend", 0.0))

    def eligible_offer() -> tuple[float, float] | None:
        """Use the configured cap and existing rounding, while never exceeding the cap."""
        if not rules.allow_discounts or not np.isfinite(aov) or aov <= 0:
            return None
        pct = _pct(tier, rules, lapsed)
        cap = aov * max(0.0, min(float(rules.max_discount_pct), 100.0)) / 100.0
        value = min(_round(aov * pct / 100.0, max(1, int(rules.round_to))), cap)
        value = round(value, 2)
        return (pct, value) if value > 0 else None

    if status == STATUS_NEW:
        return {"action_type": "Welcome message",
                "recommended_action": "Send a neutral welcome message. There is not enough order history "
                                      "to recommend a behaviour-based offer.",
                "offer_value": None, "priority": "Low"}

    if status == STATUS_AT_RISK:
        priority = {"High": "High", "Medium": "Medium", "Low": "Low"}[tier]
        if not lapsed and overdue_ratio < 1.5:
            return {"action_type": "Timed reminder",
                    "recommended_action": (f"Send a friendly reminder about their usual {interval}-day order "
                                           f"gap{fav_txt}. Hold a monetary offer for now." if interval else
                                           "Send a friendly, low-pressure reminder. Hold a monetary offer for now."),
                    "offer_value": None, "priority": "Low" if tier == "Low" else "Medium"}
        if not rules.allow_discounts:
            action = "Win-back message" if lapsed else "Personal re-engagement message"
            detail = "Send a personal win-back message without a monetary offer."
            return {"action_type": action, "recommended_action": detail, "offer_value": None, "priority": priority}
        if tier == "Low" and not lapsed:
            return {"action_type": "Personal re-engagement message",
                    "recommended_action": "Send a personal re-engagement message based on the customer's "
                                          "longer-than-usual order gap.",
                    "offer_value": None, "priority": priority}
        offer = eligible_offer()
        if offer is None:
            action = "Win-back message" if lapsed else "Personal re-engagement message"
            return {"action_type": action,
                    "recommended_action": "Send a personal re-engagement message. No eligible monetary "
                                          "offer is available from the current customer history and business rules.",
                    "offer_value": None, "priority": priority}
        pct, value = offer
        action = "Win-back offer" if lapsed else ("Strong retention offer" if tier == "High" else "Retention offer")
        reason = "This customer has been inactive far longer than usual." if lapsed else \
            "The customer's current order gap is substantially longer than their usual interval."
        return {"action_type": action,
                "recommended_action": (f"Suggest a {pct:.0f}% offer (about {sym}{value:,.2f} on a typical "
                                       f"{sym}{aov:,.2f} order){fav_txt}. {reason}"),
                "offer_value": value, "priority": priority}

    if status == STATUS_LOYAL:
        if tier == "High":
            return {"action_type": "Customer recognition",
                    "recommended_action": "Send a personal appreciation message recognising this customer's "
                                          "consistent repeat orders. No monetary offer is recommended.",
                    "offer_value": None, "priority": "Medium"}
        return {"action_type": "Appreciation message",
                "recommended_action": "Thank the customer for their consistent repeat orders. No monetary "
                                      "offer is recommended.",
                "offer_value": None, "priority": "Low"}

    # Active / Normal
    if ftrend == "Decreasing":
        return {"action_type": "Early nudge",
                "recommended_action": (f"Send a gentle reminder{fav_txt} near their usual {interval}-day "
                                       "order interval. No monetary offer is recommended." if interval else
                                       "Send a gentle reminder based on the recent change in order frequency. "
                                       "No monetary offer is recommended."),
                "offer_value": None, "priority": "Medium" if tier != "Low" else "Low"}
    return {"action_type": "Timely reminder",
            "recommended_action": (f"Send a low-pressure reminder{fav_txt} around the customer's usual "
                                   f"{interval}-day order interval." if interval else
                                   "Send a low-pressure reminder when the customer is ready to order again."),
            "offer_value": None, "priority": "Low"}


def recommend_all(df: pd.DataFrame, rules: BusinessRules | None = None) -> pd.DataFrame:
    """df needs: features + status + value_tier + is_lapsed."""
    recs = [recommend(r, r["status"], r["value_tier"], bool(r["is_lapsed"]), rules) for _, r in df.iterrows()]
    return pd.DataFrame(recs, index=df.index)
