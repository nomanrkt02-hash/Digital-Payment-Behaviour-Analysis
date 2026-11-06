"""Small helper classes that must live in an importable module (they are pickled)."""
from __future__ import annotations

import numpy as np
from sklearn.linear_model import LogisticRegression


def _logit(p):
    p = np.clip(np.asarray(p, dtype=float), 1e-4, 1 - 1e-4)
    return np.log(p / (1 - p)).reshape(-1, 1)


class ProbabilityCalibrator:
    """Platt scaling: maps raw model probabilities to better-calibrated ones."""

    def __init__(self):
        self.lr = LogisticRegression(C=1e6, max_iter=1000)

    def fit(self, raw_proba, y):
        self.lr.fit(_logit(raw_proba), np.asarray(y))
        return self

    def transform(self, raw_proba):
        return self.lr.predict_proba(_logit(raw_proba))[:, 1]


class ReturnModel:
    """Bundle: fitted sklearn model + optional calibrator + feature list + thresholds."""

    def __init__(self, model, features, calibrator=None, thresholds=None, metadata=None):
        self.model = model
        self.features = list(features)
        self.calibrator = calibrator
        self.thresholds = thresholds or {"at_risk": 0.4, "loyal": 0.75}
        self.metadata = metadata or {}

    def predict_proba(self, X):
        raw = self.model.predict_proba(X[self.features])[:, 1]
        return self.calibrator.transform(raw) if self.calibrator is not None else raw
