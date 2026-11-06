"""Model training with a TIME-BASED train / validation / test split.

Candidates: Logistic Regression (baseline), Random Forest, HistGradientBoosting.
Selection is by validation ROC-AUC (+ PR-AUC); if two models are within 0.005 the
simpler / more interpretable one wins (business suitability, not "highest accuracy").
"""
from __future__ import annotations

import warnings
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import sklearn
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, f1_score
from sklearn.model_selection import cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from . import config
from .evaluate_model import (at_risk_metrics, baseline_score, calibration_table, compute_metrics,
                             save_plots, write_report)
from .feature_engineering import MODEL_FEATURES
from .label_creation import build_training_set
from .model_utils import ProbabilityCalibrator, ReturnModel, _logit

COMPLEXITY_RANK = {"LogisticRegression": 0, "RandomForest": 1, "HistGradientBoosting": 2}


def candidate_models(fast_mode: bool = False) -> dict:
    rs = config.RANDOM_STATE
    return {
        "LogisticRegression": make_pipeline(SimpleImputer(strategy="median"), StandardScaler(),
                                            LogisticRegression(max_iter=2000, class_weight="balanced")),
        "RandomForest": make_pipeline(SimpleImputer(strategy="median"),
                                      RandomForestClassifier(n_estimators=100 if fast_mode else 300, min_samples_leaf=10,
                                                             class_weight="balanced_subsample",
                                                             n_jobs=(1 if fast_mode else -1), random_state=rs)),
        "HistGradientBoosting": HistGradientBoostingClassifier(max_depth=4, learning_rate=0.06,
                                                               max_iter=100 if fast_mode else 250, l2_regularization=1.0,
                                                               random_state=rs),
    }


def time_split(ts: pd.DataFrame, train_frac=0.6, val_frac=0.2):
    """Split by SNAPSHOT date (older -> train, middle -> validation, newest -> test)."""
    snaps = sorted(ts["snapshot"].unique())
    if len(snaps) < 5:
        raise ValueError(f"Need at least 5 snapshots for a time-based split, got {len(snaps)}.")
    n_tr = max(2, int(round(len(snaps) * train_frac)))
    n_va = max(1, int(round(len(snaps) * val_frac)))
    tr, va, te = snaps[:n_tr], snaps[n_tr:n_tr + n_va], snaps[n_tr + n_va:]
    if not te:                      # keep at least one test snapshot
        te, va = va[-1:], va[:-1] or tr[-1:]
        tr = tr[:-len(va)] if len(va) and va[0] in tr else tr
    return (ts[ts["snapshot"].isin(tr)], ts[ts["snapshot"].isin(va)], ts[ts["snapshot"].isin(te)],
            {"train": [str(pd.Timestamp(s).date()) for s in tr],
             "val": [str(pd.Timestamp(s).date()) for s in va],
             "test": [str(pd.Timestamp(s).date()) for s in te]})


def _best_at_risk_threshold(y, proba) -> float:
    """Use a conservative, business-actionable return-probability threshold.

    Validation data is still used for model selection; the risk threshold is kept at
    0.25 so the dashboard does not turn a ranking model into an oversized alert queue.
    """
    return 0.25


def train_from_training_set(ts: pd.DataFrame, data_label: str = "unspecified",
                            save_path=None, report_dir=None, verbose: bool = True,
                            fast_mode: bool = False) -> tuple[ReturnModel, dict]:
    train, val, test, split_dates = time_split(ts)
    X = lambda d: d[MODEL_FEATURES]  # noqa: E731
    y = lambda d: d["return_30d"].to_numpy()  # noqa: E731
    if len(set(y(train))) < 2 or len(set(y(val))) < 2 or len(set(y(test))) < 2:
        raise ValueError("One of the time periods has only one outcome class; more history is needed.")

    # ---- fit + validate every candidate
    fitted, val_metrics, val_proba = {}, {}, {}
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for name, mdl in candidate_models(fast_mode=fast_mode).items():
            mdl.fit(X(train), y(train))
            p = mdl.predict_proba(X(val))[:, 1]
            fitted[name], val_proba[name] = mdl, p
            val_metrics[name] = compute_metrics(y(val), p)
            if verbose:
                m = val_metrics[name]
                print(f"  {name:22s} val ROC-AUC {m['roc_auc']:.3f}  PR-AUC {m['pr_auc']:.3f}  F1 {m['f1']:.3f}")

    # ---- selection: best ROC-AUC, but prefer the simpler model if within 0.005
    best_auc = max(m["roc_auc"] for m in val_metrics.values())
    close = [n for n, m in val_metrics.items() if m["roc_auc"] >= best_auc - 0.005]
    selected = min(close, key=lambda n: COMPLEXITY_RANK[n])
    model = fitted[selected]

    # ---- probability calibration
    # Keep the raw model probability for this project. The validation calibration
    # experiment did not provide stable cross-period behaviour on the source data,
    # so the dashboard reports it as a likelihood estimate rather than a calibrated claim.
    calibrator = None
    val_final = raw_val = val_proba[selected]

    # ---- business thresholds from validation data
    at_risk_thr = _best_at_risk_threshold(y(val), val_final)
    loyal_thr = round(float(max(np.quantile(val_final, 0.65), at_risk_thr + 0.25)), 2)
    thresholds = {"at_risk": at_risk_thr, "loyal": min(loyal_thr, 0.90)}

    bundle = ReturnModel(model, MODEL_FEATURES, calibrator, thresholds)

    # ---- final, untouched test period
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        p_test = bundle.predict_proba(test)
        imp = permutation_importance(model, X(test), y(test), scoring="roc_auc",
                                     n_repeats=2 if fast_mode else 5,
                                     max_samples=0.5 if fast_mode else 1.0,
                                     random_state=config.RANDOM_STATE)
    test_metrics = compute_metrics(y(test), p_test)
    baseline_auc = float(compute_metrics(y(test), baseline_score(test))["roc_auc"])
    importance = sorted(zip(MODEL_FEATURES, imp.importances_mean.tolist()), key=lambda kv: -kv[1])

    results = {
        "data_label": data_label,
        "selected_model": selected,
        "calibrated": calibrator is not None,
        "horizon_days": config.RETURN_HORIZON_DAYS,
        "thresholds": thresholds,
        "split": {**{k: v for k, v in split_dates.items()},
                  "train_rows": int(len(train)), "val_rows": int(len(val)), "test_rows": int(len(test))},
        "validation_metrics": val_metrics,
        "test_metrics": test_metrics,
        "test_at_risk_metrics": at_risk_metrics(y(test), p_test, at_risk_thr),
        "baseline_test_roc_auc": baseline_auc,
        "feature_importance": importance,
        "calibration_table_test": calibration_table(y(test), p_test).to_dict("records"),
        "trained_at": datetime.now().isoformat(timespec="seconds"),
        "note": ("Results are specific to the uploaded/source dataset. The application does not independently "
                 "verify dataset provenance. If the data is synthetic, generated, or a demonstration file, these "
                 "metrics show pipeline behaviour only and are NOT evidence of real-world performance. Verify the "
                 "source and licence before using these results as academic real-data evidence."),
    }
    bundle.metadata = {k: results[k] for k in ("data_label", "selected_model", "calibrated", "horizon_days",
                                                "trained_at")}
    bundle.metadata["test_roc_auc"] = test_metrics["roc_auc"]
    bundle.metadata["sklearn_version"] = sklearn.__version__
    bundle.metadata["feature_importance"] = importance

    if verbose:
        print(f"  -> selected {selected} | thresholds {thresholds} | test ROC-AUC {test_metrics['roc_auc']:.3f} "
              f"(naive baseline {baseline_auc:.3f})")
    if save_path is not None:
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(bundle, save_path)
    if report_dir is not None:
        save_plots(y(test), p_test, report_dir)
        write_report(results, report_dir)
    return bundle, results


def train_from_orders(orders: pd.DataFrame, data_label: str = "unspecified", **kw):
    """Cleaned orders -> training set -> trained model."""
    ts = build_training_set(orders)
    if ts.empty:
        raise ValueError("Not enough history to build a training set.")
    return train_from_training_set(ts, data_label=data_label, **kw)


def load_model(path=config.MODEL_PATH) -> ReturnModel:
    return joblib.load(path)


def ensure_model(path=config.MODEL_PATH) -> ReturnModel:
    """Load the saved model. If it is missing, unreadable or was built with a different
    scikit-learn version, rebuild it from the built-in Synthetic Demo Data (~20 s) and save it.
    This makes the project work on any machine without manual steps."""
    try:
        m = joblib.load(path)
        v = m.metadata.get("sklearn_version")
        if v and v != sklearn.__version__:
            raise RuntimeError("scikit-learn version changed")
        return m
    except Exception:  # noqa: BLE001 - any problem -> rebuild
        from . import data_cleaning, data_validation
        from .demo_data import ensure_demo_data
        df, _ = data_validation.validate(ensure_demo_data())
        orders, _ = data_cleaning.clean(df)
        try:
            model, _ = train_from_orders(orders, data_label="Synthetic Demo Data", save_path=path, verbose=False)
        except OSError:                       # read-only folder: keep the model in memory only
            model, _ = train_from_orders(orders, data_label="Synthetic Demo Data", verbose=False)
        model.metadata["rebuilt"] = True
        return model


if __name__ == "__main__":
    from . import data_cleaning, data_validation
    from .demo_data import ensure_demo_data

    raw = ensure_demo_data()
    df, res = data_validation.validate(raw)
    orders, _ = data_cleaning.clean(df)
    print("Training on Synthetic Demo Data ...")
    train_from_orders(orders, data_label="Synthetic Demo Data", save_path=config.MODEL_PATH,
                      report_dir=config.REPORTS_DIR)
    print("Saved model ->", config.MODEL_PATH)
