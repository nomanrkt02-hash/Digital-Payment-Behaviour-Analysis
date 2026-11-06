"""Create the files used for the LIVE demonstration (all SYNTHETIC).

    python -m scripts.make_live_demo_files

Creates in data/live_demo/:
  live_demo_upload_synthetic.csv / .xlsx   clean file with DIFFERENT column names (shows auto-detection)
                                           + eight hand-designed "story" customers (C001 ... C008)
  live_demo_messy_synthetic.csv            has duplicates, bad dates, blanks, cancelled orders (warnings)
  live_demo_missing_column.csv             customer column missing (error message)
  live_demo_insufficient_history.csv       one order per customer (error message)
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from src import config
from src.demo_data import generate_demo_data

OUT = config.DATA_DIR / "live_demo"

# the file uses "real-world style" column names on purpose
RENAME = {"customer_id": "Customer Unique ID", "order_id": "Order ID", "order_date": "Order Purchase Timestamp",
          "amount": "Payment Value", "category": "Product Category", "payment_method": "Payment Type",
          "order_status": "Order Status"}


def _story(end: pd.Timestamp, rng) -> pd.DataFrame:
    rows = []

    def add(cid, start_ago, last_ago, gap_lo, gap_hi, aov, cat, pay="UPI", sigma=0.12):
        d = end - pd.Timedelta(days=start_ago)
        last = end - pd.Timedelta(days=last_ago)
        while d <= last:
            rows.append((cid, d, round(aov * float(rng.lognormal(0, sigma)), 2), cat, pay))
            d += pd.Timedelta(days=int(rng.integers(gap_lo, gap_hi + 1)))
        if rows[-1][1] != last:                      # make sure the final order is exactly on `last`
            rows.append((cid, last, round(aov * float(rng.lognormal(0, sigma)), 2), cat, pay))

    add("C001", 190, 45, 10, 15, 850, "Food & Dining")                 # usual 10-15 days, silent for 45 -> AT RISK
    add("C002", 150, 3, 7, 10, 700, "Groceries")                       # very regular, active          -> LOYAL
    add("C003", 260, 62, 14, 21, 5200, "Electronics", "Credit/Debit Card")   # big spender gone quiet -> AT RISK, High value
    add("C004", 150, 2, 6, 9, 110, "Bills & Recharge", "Wallet")       # small spender, very loyal     -> LOYAL, Low value
    rows.append(("C005", end - pd.Timedelta(days=10), 640.0, "Fashion", "UPI"))   # one order -> not scored
    # C006: gaps keep growing (10,12,16,20,26...) then silence
    d, gap = end - pd.Timedelta(days=140), 10
    while d <= end - pd.Timedelta(days=18):
        rows.append(("C006", d, round(900 * float(rng.lognormal(0, .12)), 2), "Travel", "Net Banking"))
        d += pd.Timedelta(days=gap)
        gap = int(gap * 1.25) + 1
    # C008: borderline - usual 10-15 days, silent for 35 (model is unsure -> watch closely)
    add("C008", 170, 35, 10, 15, 650, "Groceries")
    # C007: new customer, three orders in the last month
    for ago in (27, 14, 4):
        rows.append(("C007", end - pd.Timedelta(days=ago), round(480 * float(rng.lognormal(0, .1)), 2),
                     "Food & Dining", "UPI"))
    df = pd.DataFrame(rows, columns=["customer_id", "order_date", "amount", "category", "payment_method"])
    df["order_id"] = [f"S{i + 1:05d}" for i in range(len(df))]
    df["order_status"] = "Completed"
    return df


def build(seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    base = generate_demo_data(n_customers=650, start="2025-01-01", months=14, seed=seed)
    base["customer_id"] = base["customer_id"].str.replace("C", "CU-", regex=False)
    base["order_id"] = base["order_id"].str.replace("O", "ORD-", regex=False)
    base["order_date"] = pd.to_datetime(base["order_date"])
    end = base.loc[base["order_status"] == "Completed", "order_date"].max()
    story = _story(end, rng)
    df = pd.concat([story[base.columns], base], ignore_index=True)
    df["order_date"] = df["order_date"].dt.strftime("%Y-%m-%d") + " " + \
        pd.Series(rng.integers(8, 22, len(df))).astype(str).str.zfill(2).values + ":" + \
        pd.Series(rng.integers(0, 60, len(df))).astype(str).str.zfill(2).values + ":00"
    return df.sort_values("order_date").reset_index(drop=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    clean = build()
    out = clean.rename(columns=RENAME)
    out.to_csv(OUT / "live_demo_upload_synthetic.csv", index=False)
    out.to_excel(OUT / "live_demo_upload_synthetic.xlsx", index=False)

    rng = np.random.default_rng(11)
    m = out.copy()
    n = len(m)
    dup = m.sample(40, random_state=1)
    m.loc[rng.choice(n, 25, replace=False), "Order Purchase Timestamp"] = "not a date"
    m.loc[rng.choice(n, 18, replace=False), "Payment Value"] = -50
    m.loc[rng.choice(n, 12, replace=False), "Payment Value"] = np.nan
    m.loc[rng.choice(n, 30, replace=False), "Customer Unique ID"] = ""
    m.loc[rng.choice(n, 150, replace=False), "Order Status"] = "Cancelled"
    m = pd.concat([m, dup], ignore_index=True)
    m.to_csv(OUT / "live_demo_messy_synthetic.csv", index=False)

    out.drop(columns=["Customer Unique ID"]).to_csv(OUT / "live_demo_missing_column.csv", index=False)

    one = out.drop_duplicates("Customer Unique ID").head(200)
    one.to_csv(OUT / "live_demo_insufficient_history.csv", index=False)
    print("Created files in", OUT)
    for f in sorted(OUT.iterdir()):
        print("  ", f.name, f"{f.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
