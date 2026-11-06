"""Convert the Olist Brazilian E-Commerce files into the project's standard schema.

Usage:
    python -m scripts.prepare_olist path/to/olist_folder  data/raw/olist_standard.csv

Needs from the folder: olist_orders_dataset.csv, olist_customers_dataset.csv,
olist_order_payments_dataset.csv (optional: olist_order_items_dataset.csv,
olist_products_dataset.csv, product_category_name_translation.csv).

IMPORTANT: Olist uses a NEW customer_id for every order; the real person is
`customer_unique_id`. This script uses customer_unique_id. Olist has very few
repeat customers (roughly 3%) - run the dataset audit before choosing it.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd


def prepare(folder) -> pd.DataFrame:
    folder = Path(folder)
    orders = pd.read_csv(folder / "olist_orders_dataset.csv",
                         usecols=["order_id", "customer_id", "order_status", "order_purchase_timestamp"])
    cust = pd.read_csv(folder / "olist_customers_dataset.csv", usecols=["customer_id", "customer_unique_id"])
    pay = pd.read_csv(folder / "olist_order_payments_dataset.csv")

    amount = pay.groupby("order_id")["payment_value"].sum().rename("amount")
    main_pay = (pay.sort_values("payment_value", ascending=False).drop_duplicates("order_id")
                .set_index("order_id")["payment_type"].rename("payment_method"))

    df = (orders.merge(cust, on="customer_id", how="left")
          .merge(amount, on="order_id", how="left").merge(main_pay, on="order_id", how="left"))
    df = df.rename(columns={"order_purchase_timestamp": "order_date"})
    df["customer_id"] = df["customer_unique_id"]

    items_f, prod_f = folder / "olist_order_items_dataset.csv", folder / "olist_products_dataset.csv"
    if items_f.exists() and prod_f.exists():
        items = pd.read_csv(items_f, usecols=["order_id", "product_id", "price"])
        prods = pd.read_csv(prod_f, usecols=["product_id", "product_category_name"])
        tr_f = folder / "product_category_name_translation.csv"
        if tr_f.exists():
            tr = pd.read_csv(tr_f)
            prods = prods.merge(tr, on="product_category_name", how="left")
            prods["product_category_name"] = prods["product_category_name_english"].fillna(prods["product_category_name"])
        it = items.merge(prods, on="product_id", how="left")
        top = (it.sort_values("price", ascending=False).drop_duplicates("order_id")
               .set_index("order_id")["product_category_name"].rename("category"))
        df = df.merge(top, on="order_id", how="left")

    cols = ["customer_id", "order_id", "order_date", "amount", "payment_method", "order_status"]
    if "category" in df.columns:
        cols.append("category")
    return df[cols]


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    out = prepare(sys.argv[1])
    out.to_csv(sys.argv[2], index=False)
    per = out.groupby("customer_id").size()
    print(f"Wrote {len(out):,} orders for {per.shape[0]:,} customers -> {sys.argv[2]}")
    print(f"Repeat customers (>=2 orders): {(per >= 2).sum():,} ({(per >= 2).mean():.1%})")
