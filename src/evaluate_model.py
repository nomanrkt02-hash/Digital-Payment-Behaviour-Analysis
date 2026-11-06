"""Model evaluation: metrics, confusion matrix, calibration, plots."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (average_precision_score, brier_score_loss, confusion_matrix,
                             f1_score, precision_score, recall_score, roc_auc_score)

from . import config


def compute_metrics(y_true, proba, threshold: float = 0.5) -> dict:
    """Metrics with Return = 1 as the positive class."""
    y_true = np.asarray(y_true)
    proba = np.asarray(proba)
    pred = (proba >= threshold).astype(int)
    out = {
        "n": int(len(y_true)),
        "positive_rate": float(y_true.mean()),
        "threshold": float(threshold),
        "precision": float(precision_score(y_true, pred, zero_division=0)),
        "recall": float(recall_score(y_true, pred, zero_division=0)),
        "f1": float(f1_score(y_true, pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, proba)) if len(set(y_true)) > 1 else float("nan"),
        "pr_auc": float(average_precision_score(y_true, proba)) if len(set(y_true)) > 1 else float("nan"),
        "brier": float(brier_score_loss(y_true, proba)),
        "confusion_matrix": confusion_matrix(y_true, pred, labels=[0, 1]).tolist(),  # [[TN,FP],[FN,TP]]
    }
    return out


def at_risk_metrics(y_true, proba, at_risk_threshold: float) -> dict:
    """Same idea for the business-facing class: At Risk (= will NOT return)."""
    y_risk = 1 - np.asarray(y_true)
    pred_risk = (np.asarray(proba) < at_risk_threshold).astype(int)
    return {
        "threshold": float(at_risk_threshold),
        "precision": float(precision_score(y_risk, pred_risk, zero_division=0)),
        "recall": float(recall_score(y_risk, pred_risk, zero_division=0)),
        "f1": float(f1_score(y_risk, pred_risk, zero_division=0)),
        "flagged_share": float(pred_risk.mean()),
    }


def calibration_table(y_true, proba, bins: int = 10) -> pd.DataFrame:
    """Predicted vs observed return rate per probability bin."""
    d = pd.DataFrame({"p": np.asarray(proba), "y": np.asarray(y_true)})
    d["bin"] = pd.cut(d["p"], bins=np.linspace(0, 1, bins + 1), include_lowest=True)
    t = d.groupby("bin", observed=True).agg(n=("y", "size"), mean_predicted=("p", "mean"),
                                            observed_rate=("y", "mean")).reset_index()
    t["bin"] = t["bin"].astype(str)
    return t


def baseline_score(df: pd.DataFrame) -> np.ndarray:
    """Naive rule: the more overdue a customer is, the less likely they return."""
    return 1.0 / (1.0 + df["overdue_ratio"].fillna(df["overdue_ratio"].median()).to_numpy())


def save_plots(y_true, proba, out_dir: Path, prefix: str = "test") -> list[str]:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from sklearn.metrics import precision_recall_curve, roc_curve

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    files = []
    fpr, tpr, _ = roc_curve(y_true, proba)
    fig, ax = plt.subplots(figsize=(4.5, 4))
    ax.plot(fpr, tpr); ax.plot([0, 1], [0, 1], "--", c="grey")
    ax.set(xlabel="False positive rate", ylabel="True positive rate", title="ROC curve")
    fig.tight_layout(); f = out_dir / f"{prefix}_roc.png"; fig.savefig(f, dpi=120); plt.close(fig); files.append(f.name)

    pr, rc, _ = precision_recall_curve(y_true, proba)
    fig, ax = plt.subplots(figsize=(4.5, 4))
    ax.plot(rc, pr); ax.set(xlabel="Recall", ylabel="Precision", title="Precision-Recall curve")
    fig.tight_layout(); f = out_dir / f"{prefix}_pr.png"; fig.savefig(f, dpi=120); plt.close(fig); files.append(f.name)

    cal = calibration_table(y_true, proba)
    fig, ax = plt.subplots(figsize=(4.5, 4))
    ax.plot(cal["mean_predicted"], cal["observed_rate"], "o-"); ax.plot([0, 1], [0, 1], "--", c="grey")
    ax.set(xlabel="Mean predicted probability", ylabel="Observed return rate", title="Calibration")
    fig.tight_layout(); f = out_dir / f"{prefix}_calibration.png"; fig.savefig(f, dpi=120); plt.close(fig); files.append(f.name)

    cm = confusion_matrix(y_true, (np.asarray(proba) >= 0.5).astype(int), labels=[0, 1])
    fig, ax = plt.subplots(figsize=(4, 4))
    ax.imshow(cm, cmap="Blues")
    for (i, j), v in np.ndenumerate(cm):
        ax.text(j, i, str(v), ha="center", va="center")
    ax.set(xticks=[0, 1], yticks=[0, 1], xticklabels=["No return", "Return"], yticklabels=["No return", "Return"],
           xlabel="Predicted", ylabel="Actual", title="Confusion matrix (threshold 0.5)")
    fig.tight_layout(); f = out_dir / f"{prefix}_confusion.png"; fig.savefig(f, dpi=120); plt.close(fig); files.append(f.name)
    return files


def write_report(results: dict, out_dir: Path = config.REPORTS_DIR) -> Path:
    """Write evaluation_report.json and evaluation_report.md."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "evaluation_report.json").write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")

    L = ["# Model Evaluation Report", ""]
    L.append(f"**Data used for training:** {results.get('data_label', 'n/a')}  ")
    L.append(f"**Selected model:** {results['selected_model']}  ")
    L.append(f"**Target:** customer places a qualifying order within the next {results['horizon_days']} days (Return = 1)  ")
    L.append(f"**Split:** time-based (train / validation / test by snapshot date)  ")
    sp = results["split"]
    L.append(f"Train snapshots: {sp['train'][0]} → {sp['train'][-1]} ({sp['train_rows']} rows)  ")
    L.append(f"Validation: {sp['val'][0]} → {sp['val'][-1]} ({sp['val_rows']} rows)  ")
    L.append(f"Test: {sp['test'][0]} → {sp['test'][-1]} ({sp['test_rows']} rows)  ")
    L += ["", "## Model comparison (validation set)", "",
          "| Model | ROC-AUC | PR-AUC | F1 | Brier |", "|---|---|---|---|---|"]
    for name, m in results["validation_metrics"].items():
        L.append(f"| {name} | {m['roc_auc']:.3f} | {m['pr_auc']:.3f} | {m['f1']:.3f} | {m['brier']:.3f} |")
    t = results["test_metrics"]
    L += ["", "## Final test performance (most recent, unseen period)", "",
          f"- ROC-AUC: **{t['roc_auc']:.3f}**", f"- PR-AUC: **{t['pr_auc']:.3f}**",
          f"- Precision / Recall / F1 (Return=1, threshold 0.5): {t['precision']:.3f} / {t['recall']:.3f} / {t['f1']:.3f}",
          f"- Brier score: {t['brier']:.3f}",
          f"- Confusion matrix [[TN, FP], [FN, TP]]: {t['confusion_matrix']}",
          f"- Naive baseline (overdue-ratio rule) ROC-AUC: {results['baseline_test_roc_auc']:.3f}",
          "", "### At-Risk class (will NOT return)", ""]
    a = results["test_at_risk_metrics"]
    L += [f"- Threshold: probability < {a['threshold']:.2f}",
          f"- Precision {a['precision']:.3f}, Recall {a['recall']:.3f}, F1 {a['f1']:.3f}; flagged share {a['flagged_share']:.1%}"]
    L += ["", "## Top features (permutation importance on test set)", ""]
    for k, v in results["feature_importance"][:10]:
        L.append(f"- {k}: {v:.4f}")
    L += ["", "## Notes", "", results.get("note", "")]
    (out_dir / "evaluation_report.md").write_text("\n".join(L), encoding="utf-8")
    return out_dir / "evaluation_report.md"
