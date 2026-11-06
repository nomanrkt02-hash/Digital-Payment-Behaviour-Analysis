"""Synthetic demo data generator.

IMPORTANT: this data is SYNTHETIC. It exists so the application can be explored
without a private dataset. It must never be presented as real-world evidence of
model performance. Label it "Synthetic Demo Data" wherever it is shown.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from . import config

CATEGORIES = ["Food & Dining", "Groceries", "Fashion", "Electronics", "Bills & Recharge", "Travel"]
PAYMENT_METHODS = ["UPI", "Credit/Debit Card", "Wallet", "Net Banking", "Cash on Delivery"]


def generate_demo_data(n_customers: int = 1500, start: str = "2024-01-01", months: int = 24,
                       seed: int = config.RANDOM_STATE) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    t0 = pd.Timestamp(start)
    t_end = t0 + pd.DateOffset(months=months)
    horizon_days = (t_end - t0).days
    rows = []
    archetypes = [("loyal", 0.22, (5, 12)), ("regular", 0.38, (12, 25)),
                  ("occasional", 0.28, (25, 55)), ("rare", 0.12, (55, 100))]
    probs = [a[1] for a in archetypes]

    for i in range(n_customers):
        cid = f"C{i + 1:05d}"
        _, _, (lo, hi) = archetypes[rng.choice(len(archetypes), p=probs)]
        interval = rng.uniform(lo, hi)
        aov = float(np.clip(rng.lognormal(mean=6.4, sigma=0.7), 150, 12000))   # INR
        cat_pref = rng.choice(CATEGORIES, p=rng.dirichlet(np.ones(len(CATEGORIES)) * 0.6))
        pay_pref = rng.choice(PAYMENT_METHODS, p=[0.5, 0.2, 0.15, 0.1, 0.05])

        # when does the customer join?  (more joiners early, but some join late)
        day = float(rng.uniform(0, horizon_days * 0.85))
        # churn behaviour: ~65% eventually fade out; ~25% have a temporary slump
        churn_at = day + rng.uniform(60, horizon_days) if rng.random() < 0.65 else np.inf
        slump = (rng.uniform(day, horizon_days), rng.uniform(20, 45)) if rng.random() < 0.20 else None
        abrupt = rng.random() < 0.6            # half of the churners simply stop ordering
        fade_factor = 1.0
        fading = False

        while day < horizon_days:
            d = t0 + pd.Timedelta(days=int(day))
            if d >= t_end:
                break
            amount = max(30.0, aov * rng.lognormal(0, 0.28))
            cat = cat_pref if rng.random() < 0.7 else rng.choice(CATEGORIES)
            pay = pay_pref if rng.random() < 0.75 else rng.choice(PAYMENT_METHODS)
            status = "Cancelled" if rng.random() < 0.02 else "Completed"
            rows.append((cid, f"O{len(rows) + 1:07d}", d, round(amount, 2), cat, pay, status))

            gap = rng.gamma(shape=4.0, scale=(interval * fade_factor) / 4.0)
            if slump and slump[0] <= day <= slump[0] + slump[1]:
                gap *= 1.8
            gap = max(1.0, gap)
            if day >= churn_at:
                if abrupt:                             # stops ordering altogether
                    break
                fading = True                          # otherwise gaps stretch, then stop
            if fading:
                fade_factor *= rng.uniform(1.8, 2.6)
                if fade_factor > 5.0:
                    break
            day += gap

    df = pd.DataFrame(rows, columns=["customer_id", "order_id", "order_date", "amount",
                                     "category", "payment_method", "order_status"])
    df["order_date"] = df["order_date"].dt.strftime("%Y-%m-%d")
    return df.sample(frac=1.0, random_state=seed).reset_index(drop=True)


def ensure_demo_data(path=config.DEMO_DATA_PATH, regenerate: bool = False) -> pd.DataFrame:
    """Load the demo CSV, creating it first if it does not exist."""
    path = Path(path)
    if regenerate or not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        generate_demo_data().to_csv(path, index=False)
    return pd.read_csv(path)
