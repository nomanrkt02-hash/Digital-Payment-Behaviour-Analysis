"""Convert UCI Online Retail II XLSX to canonical order rows.

Usage: python -m scripts.prepare_online_retail_ii path/to/online_retail_II.xlsx data/processed/online_retail_ii_standard.csv

This dataset has no payment-method field. It is an alternative if Olist's repeat-customer
coverage is too sparse, but that limitation must be disclosed in the project.
"""
from __future__ import annotations
import sys
from pathlib import Path
import pandas as pd


def prepare(path) -> pd.DataFrame:
    frames = []
    for sheet, raw in pd.read_excel(Path(path), sheet_name=None).items():
        df = raw.copy()
        df.columns = [str(c).strip() for c in df.columns]
        aliases = {
            "InvoiceNo": "order_id", "Invoice": "order_id",
            "InvoiceDate": "order_date", "Customer ID": "customer_id", "CustomerID": "customer_id",
            "UnitPrice": "unit_price", "Price": "unit_price", "Description": "category",
        }
        df = df.rename(columns={c: aliases[c] for c in df.columns if c in aliases})
        required = {"order_id", "order_date", "customer_id", "Quantity", "unit_price", "category"}
        if not required.issubset(df.columns):
            continue
        df["amount"] = pd.to_numeric(df["Quantity"], errors="coerce") * pd.to_numeric(df["unit_price"], errors="coerce")
        df["order_status"] = df["order_id"].astype(str).str.upper().str.startswith("C").map({True: "cancelled", False: "completed"})
        df = df[df["customer_id"].notna()]
        df = df[["customer_id", "order_id", "order_date", "amount", "category", "order_status"]]
        frames.append(df)
    if not frames:
        raise ValueError("Could not find expected Online Retail II columns in the workbook sheets.")
    items = pd.concat(frames, ignore_index=True)
    items["customer_id"] = items["customer_id"].astype(str).str.replace(r"\.0$", "", regex=True)
    items["order_date"] = pd.to_datetime(items["order_date"], errors="coerce")
    items["amount"] = pd.to_numeric(items["amount"], errors="coerce")
    # Aggregate item lines into one row per invoice. The shared cleaning pipeline expects orders,
    # not line items, and otherwise duplicate removal would discard legitimate basket items.
    items["category"] = items["category"].fillna("Unknown").astype(str)
    grouped = items.groupby(["customer_id", "order_id"], as_index=False).agg(
        order_date=("order_date", "min"), amount=("amount", "sum"),
        category=("category", lambda x: x.value_counts().index[0] if len(x.value_counts()) else "Unknown"),
        order_status=("order_status", "first"),
    )
    return grouped


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    output = Path(sys.argv[2])
    output.parent.mkdir(parents=True, exist_ok=True)
    df = prepare(sys.argv[1])
    df.to_csv(output, index=False)
    counts = df.groupby("customer_id")["order_id"].nunique()
    print(f"Wrote {len(df):,} orders for {counts.size:,} customers -> {output}")
    print(f"Repeat customers (>=2 orders): {(counts >= 2).sum():,} ({(counts >= 2).mean():.1%})")
