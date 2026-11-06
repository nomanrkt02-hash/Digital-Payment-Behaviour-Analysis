import tempfile
from pathlib import Path

import pandas as pd

from scripts.prepare_olist import prepare


def test_olist_adapter_builds_standard_schema():
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        pd.DataFrame({"order_id": ["o1", "o2"], "customer_id": ["c1", "c2"], "order_status": ["delivered", "canceled"],
                      "order_purchase_timestamp": ["2018-01-01 10:00:00", "2018-01-05 11:00:00"]}).to_csv(d / "olist_orders_dataset.csv", index=False)
        pd.DataFrame({"customer_id": ["c1", "c2"], "customer_unique_id": ["u1", "u1"]}).to_csv(d / "olist_customers_dataset.csv", index=False)
        pd.DataFrame({"order_id": ["o1", "o1", "o2"], "payment_type": ["credit_card", "voucher", "boleto"],
                      "payment_value": [80.0, 20.0, 50.0]}).to_csv(d / "olist_order_payments_dataset.csv", index=False)
        out = prepare(d)
        assert set(["customer_id", "order_id", "order_date", "amount", "payment_method", "order_status"]) <= set(out.columns)
        assert out.loc[out.order_id == "o1", "amount"].iloc[0] == 100.0
        assert set(out["customer_id"]) == {"u1"}      # unique customer id used, not per-order id
