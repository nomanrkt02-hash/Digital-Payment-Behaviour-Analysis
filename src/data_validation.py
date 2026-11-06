"""Dataset validation.

Turns a raw uploaded file into a standard dataframe and a ValidationResult
containing HUMAN-READABLE errors / warnings (never Python tracebacks).
"""
from __future__ import annotations

import re
import warnings
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd

from . import config


@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    stats: dict[str, Any] = field(default_factory=dict)
    column_map: dict[str, str] = field(default_factory=dict)  # original -> canonical

    @property
    def is_valid(self) -> bool:
        return not self.errors

    def as_dict(self) -> dict:
        return {"is_valid": self.is_valid, "errors": self.errors,
                "warnings": self.warnings, "stats": self.stats,
                "column_map": self.column_map}


# --------------------------------------------------------------------------- #
# Date parsing (shared with data_cleaning)
# --------------------------------------------------------------------------- #
_DMY_LIKE = re.compile(r"^\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})")


def parse_dates(series: pd.Series) -> tuple[pd.Series, str | None]:
    """Parse a date column robustly. Returns (datetime series with NaT for bad values, note or None).

    Handles real Excel dates, ISO strings and mixed formats. For dd-mm-yyyy style text it detects
    day-first automatically when possible (e.g. 25-03-2026) and warns when it is ambiguous
    (e.g. 05-03-2026 could be 5 March or 3 May).
    """
    if pd.api.types.is_datetime64_any_dtype(series):
        return pd.to_datetime(series, errors="coerce"), None
    text = series.astype(str)
    parts = text.str.extract(_DMY_LIKE).apply(pd.to_numeric, errors="coerce")
    dayfirst, note = False, None
    if parts.notna().all(axis=1).mean() > 0.5:
        first_gt12 = (parts[0] > 12).any()
        second_gt12 = (parts[1] > 12).any()
        if first_gt12 and not second_gt12:
            dayfirst = True
        elif not first_gt12 and not second_gt12:
            note = ("Dates such as 05-03-2026 are ambiguous; they were read as MM-DD-YYYY. "
                    "Use YYYY-MM-DD if that is wrong.")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            out = pd.to_datetime(series, errors="coerce", dayfirst=dayfirst, format="mixed")
        except (TypeError, ValueError):
            out = pd.to_datetime(series, errors="coerce", dayfirst=dayfirst)
    return out, note


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #
def load_file(source) -> tuple[pd.DataFrame | None, ValidationResult]:
    """Read CSV/XLSX from a path or a file-like object (e.g. Streamlit upload).

    Returns (dataframe or None, ValidationResult). Never raises for bad files.
    """
    res = ValidationResult()
    name = getattr(source, "name", None) or str(source)
    suffix = Path(name).suffix.lower()
    if suffix not in {".csv", ".xlsx", ".xls"}:
        res.errors.append(f"Unsupported file format '{suffix or 'unknown'}'. Please upload a CSV or XLSX file.")
        return None, res
    try:
        if hasattr(source, "seek"):
            source.seek(0)
        if suffix == ".csv":
            df = pd.read_csv(source, low_memory=False)
        else:
            df = pd.read_excel(source)
    except Exception as exc:  # noqa: BLE001 - convert to friendly message
        res.errors.append(f"The file could not be read ({type(exc).__name__}). "
                          "Please check that it is a valid, non-corrupted CSV/XLSX file.")
        return None, res
    if df.empty:
        res.errors.append("The file is empty - it has no rows.")
        return None, res
    return df, res


# --------------------------------------------------------------------------- #
# Column standardisation
# --------------------------------------------------------------------------- #
def standardise_columns(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, str]]:
    """Rename recognised alternative column names to the canonical schema."""
    norm = {c: str(c).strip().lower().replace(" ", "_") for c in df.columns}
    rename: dict[str, str] = {}
    used: set[str] = set()
    for canonical, aliases in config.COLUMN_ALIASES.items():
        for original, n in norm.items():
            if original in rename or canonical in used:
                continue
            if n in aliases:
                rename[original] = canonical
                used.add(canonical)
                break
    out = df.rename(columns=rename)
    return out, {str(k): v for k, v in rename.items()}


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #
def validate(df: pd.DataFrame) -> tuple[pd.DataFrame | None, ValidationResult]:
    """Validate a dataframe. Returns (standardised df or None if invalid, result)."""
    res = ValidationResult()
    if df is None or len(df) == 0:
        res.errors.append("The file is empty - it has no rows.")
        return None, res

    df, res.column_map = standardise_columns(df)

    # ---- required columns
    missing = [c for c in config.REQUIRED_COLUMNS if c not in df.columns]
    for c in missing:
        res.errors.append(f"Missing required column: {c}")
    if missing:
        res.stats["columns_found"] = [str(c) for c in df.columns]
        return None, res

    n = len(df)
    res.stats["rows"] = int(n)

    # ---- empty customer IDs
    cust_blank = df["customer_id"].isna() | (df["customer_id"].astype(str).str.strip() == "")
    if cust_blank.sum():
        frac = cust_blank.mean()
        msg = f"{int(cust_blank.sum())} rows have an empty customer_id and will be removed."
        (res.errors if frac > config.MAX_MISSING_FRACTION_ERROR else res.warnings).append(msg)

    # ---- invalid dates
    dates, date_note = parse_dates(df["order_date"])
    if date_note:
        res.warnings.append(date_note)
    bad_dates = dates.isna()
    if bad_dates.sum():
        frac = bad_dates.mean()
        if frac > config.MAX_MISSING_FRACTION_ERROR:
            res.errors.append("Most values in 'order_date' are not valid dates. "
                              "Please use a format such as 2025-03-14.")
        else:
            res.warnings.append(f"{int(bad_dates.sum())} rows have an invalid order_date and will be removed.")

    # ---- invalid amounts
    amounts = pd.to_numeric(df["amount"], errors="coerce")
    bad_amt = amounts.isna()
    if bad_amt.sum():
        if bad_amt.mean() > config.MAX_MISSING_FRACTION_ERROR:
            res.errors.append("Most values in 'amount' are not numbers.")
        else:
            res.warnings.append(f"{int(bad_amt.sum())} rows have a missing/non-numeric amount and will be removed.")
    non_pos = (amounts <= 0).sum()
    if non_pos:
        res.warnings.append(f"{int(non_pos)} rows have an amount of zero or less and will be removed.")

    # ---- duplicates
    dup = df.duplicated(subset=["customer_id", "order_id"]).sum()
    if dup:
        res.warnings.append(f"{int(dup)} duplicate records (same customer_id + order_id) will be removed.")

    # ---- cancelled orders
    if "order_status" in df.columns:
        st = df["order_status"].astype(str).str.strip().str.lower()
        canc = st.isin(config.EXCLUDED_STATUSES).sum()
        if canc:
            res.warnings.append(f"{int(canc)} cancelled/failed orders will be excluded from analysis.")

    if res.errors:
        return None, res

    # ---- history checks (on rows that look valid)
    ok = ~cust_blank & ~bad_dates & ~bad_amt
    d = pd.DataFrame({"customer_id": df.loc[ok, "customer_id"].astype(str),
                      "order_date": dates[ok]})
    if d.empty:
        res.errors.append("No valid rows remain after checking customer_id, order_date and amount.")
        return None, res
    per_cust = d.groupby("customer_id").size()
    span_days = int((d["order_date"].max() - d["order_date"].min()).days)
    res.stats.update({
        "customers": int(per_cust.shape[0]),
        "repeat_customers": int((per_cust >= 2).sum()),
        "date_min": str(d["order_date"].min().date()),
        "date_max": str(d["order_date"].max().date()),
        "history_days": span_days,
    })
    if (per_cust >= 2).sum() == 0:
        res.errors.append("Insufficient history: no customer has more than one order, so behaviour "
                          "cannot be learned. Please upload data with repeat customers.")
    elif (per_cust >= 2).mean() < 0.05:
        res.warnings.append("Very few repeat customers (<5%). Predictions will cover only customers "
                            "with at least 2 orders and may be unreliable.")
    if span_days < 60:
        res.errors.append(f"Insufficient history: data covers only {span_days} days. "
                          "At least 60 days of transactions are needed.")
    elif span_days < config.MIN_HISTORY_DAYS_FOR_TRAINING:
        res.warnings.append(f"Data covers only {span_days} days. A model cannot be trained on this "
                            "dataset alone; the saved demo-trained model will be used instead.")
    if res.errors:
        return None, res
    return df, res


def validate_file(source) -> tuple[pd.DataFrame | None, ValidationResult]:
    """Convenience: load + validate in one call (what the UI uses)."""
    df, res = load_file(source)
    if df is None:
        return None, res
    df2, res2 = validate(df)
    res2.warnings = res.warnings + res2.warnings
    return df2, res2
