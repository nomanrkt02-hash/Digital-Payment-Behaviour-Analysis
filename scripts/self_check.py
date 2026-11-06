"""One-command health check for the whole backend.

    python scripts/self_check.py

Prints [OK] / [FAIL] for every step and exits with a non-zero code if anything failed.
If something fails, copy the printed message (and the traceback) - see docs/VSCODE_CHECK_PROMPT.md.
"""
from __future__ import annotations

import importlib
import subprocess
import sys
import tempfile
import time
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

results: list[tuple[str, bool, str]] = []


def step(name):
    def deco(fn):
        t = time.time()
        try:
            msg = fn() or ""
            results.append((name, True, msg))
            print(f"[OK]   {name} {('- ' + msg) if msg else ''} ({time.time() - t:.1f}s)")
        except Exception as exc:  # noqa: BLE001
            results.append((name, False, f"{type(exc).__name__}: {exc}"))
            print(f"[FAIL] {name}: {type(exc).__name__}: {exc}")
            traceback.print_exc()
        return fn
    return deco


@step("Python version (3.10 - 3.13 expected)")
def _py():
    v = sys.version_info
    assert (3, 10) <= (v.major, v.minor) <= (3, 13), f"found {v.major}.{v.minor}; 3.12 is recommended"
    return f"{v.major}.{v.minor}.{v.micro}"


@step("Required libraries")
def _libs():
    out = []
    for m in ("pandas", "numpy", "sklearn", "joblib", "matplotlib", "openpyxl"):
        out.append(f"{m} {importlib.import_module(m).__version__}")
    return ", ".join(out)


@step("Active project libraries (fastapi, uvicorn, pytest)")
def _opt():
    missing = []
    for m in ("fastapi", "uvicorn", "pytest"):
        try:
            importlib.import_module(m)
        except ImportError:
            missing.append(m)
    if missing:
        raise AssertionError("missing: " + ", ".join(missing) + "  ->  run SETUP_WINDOWS.bat")


from src import config  # noqa: E402


@step("Demo data present / generated")
def _demo_data():
    from src.demo_data import ensure_demo_data
    df = ensure_demo_data()
    return f"{len(df):,} rows"


@step("Model loads (rebuilds itself if needed)")
def _model():
    from src.train_model import ensure_model
    m = ensure_model()
    return f"{m.metadata.get('selected_model')}, thresholds {m.thresholds}"


@step("Demo pipeline (Explore Demo Data)")
def _demo():
    from src.prediction_pipeline import run_demo
    r = run_demo()
    assert r.ok, r.validation.errors
    assert r.customers["return_probability"].dropna().between(0, 1).all()
    assert set(r.analytics) >= {"status_distribution", "attention", "return_trend", "segments", "data_quality"}
    return f"{r.summary['total_customers']:,} customers; at risk {r.summary['at_risk']}"


@step("Live-demo files (CSV, XLSX, messy, error files)")
def _live():
    from src.prediction_pipeline import run_pipeline
    d = config.DATA_DIR / "live_demo"
    if not (d / "live_demo_upload_synthetic.csv").exists():
        subprocess.run([sys.executable, "-m", "scripts.make_live_demo_files"], check=True, cwd=ROOT)
    a = run_pipeline(d / "live_demo_upload_synthetic.csv")
    b = run_pipeline(d / "live_demo_upload_synthetic.xlsx")
    m = run_pipeline(d / "live_demo_messy_synthetic.csv")
    e1 = run_pipeline(d / "live_demo_missing_column.csv")
    e2 = run_pipeline(d / "live_demo_insufficient_history.csv")
    assert a.ok and b.ok and m.ok, "valid files should work"
    assert not e1.ok and not e2.ok, "error files should be rejected"
    assert all("Traceback" not in x for x in e1.validation.errors + e2.validation.errors)
    return f"upload {a.summary['total_customers']} customers; messy file gave {len(m.validation.warnings)} warnings"


@step("Train on uploaded data (retrain=True)")
def _retrain():
    from src.prediction_pipeline import run_pipeline
    r = run_pipeline(config.DATA_DIR / "live_demo" / "live_demo_upload_synthetic.csv", retrain=True)
    assert r.ok and "uploaded" in r.model_info["source"].lower(), r.model_info
    return r.model_info["source"]


@step("Reports / exports build")
def _reports():
    from src.prediction_pipeline import run_demo
    from src.reporting import build_excel, build_html_report
    r = run_demo()
    assert len(build_excel(r, r.analytics["return_trend"])) > 1000
    assert "<html" in build_html_report(r, r.analytics["return_trend"])


@step("Write files with non-ASCII text (rupee sign, arrows) - Windows encoding check")
def _encoding():
    from src.evaluate_model import write_report  # noqa: F401
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "x.md"
        p.write_text("Rs \u20b9 -> \u2192", encoding="utf-8")
        assert "\u20b9" in p.read_text(encoding="utf-8")


@step("Automated tests (pytest)")
def _pytest():
    try:
        import pytest  # noqa: F401
    except ImportError:
        raise AssertionError("pytest not installed - run: pip install pytest")
    p = subprocess.run([sys.executable, "-m", "pytest", "-q", "-x", "--no-header", "-p", "no:cacheprovider"],
                       cwd=ROOT, capture_output=True, text=True)
    tail = (p.stdout or "").strip().splitlines()[-1:]
    if p.returncode != 0:
        print(p.stdout[-3000:], p.stderr[-1500:])
        raise AssertionError("pytest reported failures")
    return tail[0] if tail else ""


print("\n" + "=" * 60)
failed = [r for r in results if not r[1]]
if failed:
    print(f"{len(failed)} of {len(results)} checks FAILED:")
    for n, _, m in failed:
        print(f"  - {n}: {m}")
    sys.exit(1)
print(f"ALL {len(results)} CHECKS PASSED")
