"""Command-line entry point.

    python main.py setup            # make demo data + train model + evaluation report
    python main.py demo             # run the full pipeline on the demo data, print a summary
    python main.py predict FILE     # train/evaluate on uploaded data, then predict (strict by default)
    python main.py audit FILE       # dataset audit
"""
from __future__ import annotations

import argparse
import json
import sys

from src import config
from src.demo_data import ensure_demo_data


def _utf8_console() -> None:
    """Windows consoles default to cp1252, which cannot print some characters (e.g. the rupee sign)."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def _print(res):
    if not res.ok:
        print("Could not process the file:")
        for e in res.validation.errors:
            print("  [ERROR]", e)
        return
    for w in res.validation.warnings:
        print("  [WARNING]", w)
    for n in res.notes:
        print("  [NOTE]", n)
    print(json.dumps(res.summary, indent=2))
    print("Model:", res.model_info["source"], "-", res.model_info["model_name"])
    cols = ["customer_id", "return_probability_pct", "status", "value_tier", "recommended_action"]
    print(res.customers[cols].head(10).to_string(index=False))


def main():
    _utf8_console()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["setup", "demo", "predict", "audit"])
    ap.add_argument("file", nargs="?")
    ap.add_argument("--use-demo-model", action="store_true", help="explicitly opt in to the synthetic demo-trained model if upload training is not wanted")
    ap.add_argument("--out", help="save customer predictions to this CSV")
    a = ap.parse_args()

    if a.command == "setup":
        from src import data_cleaning, data_validation
        from src.train_model import train_from_orders
        raw = ensure_demo_data(regenerate=True)
        df, _ = data_validation.validate(raw)
        orders, _ = data_cleaning.clean(df)
        print("Training on Synthetic Demo Data ...")
        train_from_orders(orders, data_label="Synthetic Demo Data", save_path=config.MODEL_PATH,
                          report_dir=config.REPORTS_DIR)
        print(f"Done. Model: {config.MODEL_PATH}\nReport: {config.REPORTS_DIR / 'evaluation_report.md'}")
    elif a.command == "demo":
        from src.prediction_pipeline import run_demo
        _print(run_demo())
    elif a.command == "predict":
        if not a.file:
            ap.error("predict needs a FILE")
        from src.prediction_pipeline import run_pipeline
        res = run_pipeline(a.file, retrain=not a.use_demo_model, strict_retrain=not a.use_demo_model,
                           data_label="Uploaded dataset")
        _print(res)
        if res.ok and a.out:
            res.customers.drop(columns=["why_list"]).to_csv(a.out, index=False, encoding="utf-8-sig")  # utf-8-sig: opens correctly in Excel
            print("Saved ->", a.out)
    else:
        if not a.file:
            ap.error("audit needs a FILE")
        from scripts.audit_dataset import audit
        print(json.dumps(audit(a.file), indent=2, default=str))


if __name__ == "__main__":
    main()
