"""Central configuration. Change values here, not inside the modules."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SAMPLE_DIR = DATA_DIR / "sample"
PROCESSED_DIR = DATA_DIR / "processed"
MODELS_DIR = ROOT / "models"
REPORTS_DIR = ROOT / "reports"

DEMO_DATA_PATH = SAMPLE_DIR / "demo_transactions.csv"
MODEL_PATH = MODELS_DIR / "return_model.joblib"

# ---- Standard (canonical) schema -------------------------------------------
REQUIRED_COLUMNS = ["customer_id", "order_id", "order_date", "amount"]
OPTIONAL_COLUMNS = ["category", "payment_method", "order_status"]

# Accepted alternative column names -> canonical name (lower-case, stripped)
COLUMN_ALIASES = {
    "customer_id": ["customer_id", "customerid", "cust_id", "customer", "customer_unique_id",
                    "user_id", "userid", "client_id"],
    "order_id": ["order_id", "orderid", "transaction_id", "txn_id", "transactionid",
                 "invoice_no", "invoice", "invoiceno", "payment_id"],
    "order_date": ["order_date", "date", "transaction_date", "txn_date", "order_purchase_timestamp",
                   "invoicedate", "timestamp", "datetime", "purchase_date", "created_at"],
    "amount": ["amount", "order_amount", "order_value", "transaction_amount", "payment_value",
               "total", "total_amount", "price", "value", "txn_amount"],
    "category": ["category", "product_category", "product_category_name", "item_category"],
    "payment_method": ["payment_method", "payment_type", "payment_mode", "mode", "payment"],
    "order_status": ["order_status", "status", "transaction_status"],
}

# Statuses treated as NOT a qualifying order (compared lower-case)
EXCLUDED_STATUSES = {"cancelled", "canceled", "failed", "refunded", "returned", "unavailable",
                     "declined", "reversed", "void"}

# ---- Project definitions ----------------------------------------------------
RETURN_HORIZON_DAYS = 30          # "returns within the next 30 days"
SNAPSHOT_STEP_DAYS = 30           # spacing of training snapshots
MIN_ORDERS_FOR_PREDICTION = 2     # customers with fewer orders get "Not enough history"
MIN_HISTORY_DAYS_FOR_TRAINING = 150   # data span needed to train a model on a dataset
RANDOM_STATE = 42

# Validation limits
MAX_MISSING_FRACTION_ERROR = 0.5  # >50% of rows broken in a required column -> error
