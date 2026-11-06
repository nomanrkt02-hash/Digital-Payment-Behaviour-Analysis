# Digital Payment Behaviour Analysis

A local analytics prototype for customer purchase behaviour and repeat-purchase likelihood. The application combines a Python analysis API with a React interface. Its project-defined prediction question is: **Will the customer place another qualifying order within the next 30 days?**

> The bundled transaction data is synthetic. The bundled model was trained on synthetic demo data. Outputs demonstrate the pipeline and are not evidence of real-world performance.

## Problem and objectives

The project explores how historical order cadence, recency, frequency and spending can support customer follow-up decisions. It aims to validate and clean transaction files, derive customer-level behavioural features, estimate a 30-day return probability, summarize customer status, and present rule-based follow-up suggestions. It does not estimate causal campaign impact or contractual churn.

## Features

- Synthetic demo flow and CSV/XLSX upload with validation and cleaning.
- Customer-level return estimates, status and descriptive value tiers.
- Overview, customer detail, insights, transaction data, outreach drafts, reports and settings screens.
- A time-aware training pipeline for eligible uploaded datasets.
- Rule-based reasons and recommendations, kept separate from the model prediction.
- CSV and Excel input handling and customer/order analytics.

## How it works

1. The API receives the built-in synthetic demo or a CSV/XLSX upload.
2. Validation maps recognized column aliases to the canonical schema; cleaning removes invalid/non-qualifying rows.
3. Features are computed from orders up to a snapshot date.
4. The backend scores eligible customers with the bundled demo-trained model, or trains on a sufficiently long uploaded dataset when strict upload analysis is requested.
5. Thresholds assign customer status. Separate business rules generate reasons, value tiers and suggested actions.
6. The FastAPI service returns JSON for the React interface.

### Prediction and machine learning

The target is a qualifying order within 30 days after a snapshot. The training code compares Logistic Regression, Random Forest and HistGradientBoosting using chronological train, validation and test periods. Model selection uses validation ROC-AUC and a simplicity preference for near-ties. No performance metric is claimed here; bundled synthetic results are pipeline checks only, and uploaded data needs a suitable time span and valid labels/split.

Behavioral features in the implementation include recency, order frequency, usual order interval and its variability, overdue ratio, recent order counts, average order value, spending and frequency trends, active months, tenure, order rate and consistency. Features use history through the snapshot; the target looks forward. Some requested concepts such as “recent activity” map to recent-window counts in code.

### Status, value and recommendations

Status labels use model probabilities and stored thresholds, with customers who lack sufficient order history left unscored. Value tiers, risk reasons and suggested actions are rule-based business logic. They are not ML clusters or model-generated recommendations. Payment method is optional input metadata; the included prepared UCI-derived data is not included here and the application does not claim payment-method prediction.

## Technology

- Python, pandas, NumPy, scikit-learn, joblib
- FastAPI, Uvicorn, Pydantic, python-multipart
- React, TypeScript, Vite, TanStack Start/Router
- npm lockfile for the frontend; `requirements.txt` for Python

## Architecture

```text
CSV/XLSX or synthetic demo
          |
          v
FastAPI -> validation -> cleaning -> behavioural features -> model score
                                            |                    |
                                            +-> status/value/rule-based actions
                                                                  |
                                                                  v
                                                        FastAPI JSON API
                                                                  |
                                                                  v
                                                         React frontend
```

The API keeps the active analysis in process memory. The repository contains no database or authentication layer. See [`docs/UI_INTEGRATION.md`](docs/UI_INTEGRATION.md) for the API contract overview and [`docs/LIVE_DEMO_GUIDE.md`](docs/LIVE_DEMO_GUIDE.md) for the synthetic demonstration files.

## Data and validation

`data/sample/` and `data/live_demo/` contain generated synthetic demo/test transactions, including files that exercise validation warnings and errors. They are not Google Forms responses and do not represent real customers. No survey response dataset is included in this copy.

The separately present UCI Online Retail II-derived CSV and model were omitted: the checked-in preparation describes historical retail invoices without a payment-method field, and provenance for the prepared INR conversion was not established in this packaging audit. The original project notes cite UCI Online Retail II and CC BY 4.0, but the project-derived file's transformation/source details still need review before redistribution. To use real data, obtain it from its source, review its terms, and prepare/audit your own copy; do not place private customer records in the repository.

The canonical required input columns are `customer_id`, `order_id`, `order_date`, and `amount`. Optional columns are `category`, `payment_method`, and `order_status`. The validator recognizes aliases. Project documentation describes at least 60 days plus repeat-customer history for analysis and at least 150 days for an upload training attempt. Files that do not support strict time-based training are rejected by the API rather than silently substituted with the synthetic model.

## Project structure

```text
api.py, main.py, app.py       FastAPI API, CLI and legacy Streamlit smoke-test entry point
src/                          Validation, cleaning, features, model, pipeline and analytics
scripts/                       Dataset adapters, audits and synthetic demo-file generator
tests/                         Python and frontend tests
ui/                            Supporting UI modules
frontend/                      React/TypeScript application and npm configuration
data/sample/                   Synthetic demo transactions
data/live_demo/                Synthetic upload/validation examples
models/return_model.joblib     Synthetic demo-trained model used by the default pipeline
docs/                          Dataset, live-demo and UI integration notes
documentation/screenshots/     Existing application screenshots
```

## Installation

Requirements recorded by the project: Python 3.12 recommended (Python 3.13 may work), Node.js LTS and npm. No dependency installation was performed during packaging.

From the repository root, create and activate a virtual environment, then install the checked-in requirements:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Install frontend dependencies in a second step:

```powershell
cd frontend
npm install
cd ..
```

The bundled model is a Python joblib serialization. Only load model files you trust. Python and frontend packages should be installed from the checked-in manifests/lockfile.

## Run the backend

From the repository root:

```powershell
python -m uvicorn api:app --host 127.0.0.1 --port 8000
```

Optional backend CORS configuration: `DPBA_ALLOWED_ORIGINS` is comma-separated and defaults to local development origins. It is not required for the documented local setup.

## Run the frontend

From `frontend/`:

```powershell
npm run dev -- --host 127.0.0.1 --port 8080 --strictPort
```

The API client defaults to `http://127.0.0.1:8000`. Optional build-time override: `VITE_API_BASE_URL`. No `.env.example` is included because neither variable is required for the default local setup.

On Windows, the included `SETUP_WINDOWS.bat`, `SETUP_FRONTEND.bat`, and `START_PROJECT.bat` provide project-specific setup/start helpers. Review commands before running scripts on your machine.

## Use the application

Open `http://127.0.0.1:8080`, then choose the demo or upload a CSV/XLSX file. Review validation results before analysis. Do not upload personal or confidential data unless you have permission and a suitable local handling process. The app holds the active analysis in backend memory; restarting the API clears it. Outreach controls prepare drafts and do not send or schedule messages.

CLI examples from the root:

```powershell
python main.py demo
python main.py audit path/to/transactions.csv
python main.py predict path/to/transactions.csv --out predictions.csv
```

`main.py setup` trains a new synthetic demo model and writes model/report artifacts; run it only if you intentionally want to regenerate these files.

## API overview

- `GET /api/health` — service status
- `GET /api/preview` — demo or current-result preview
- `POST /api/demo` — load the synthetic demo
- `GET /api/current` — current in-memory result
- `POST /api/analyze` — analyze a CSV/XLSX upload
- `POST /api/settings` — recalculate rule-based recommendations
- `GET /api/customer/{customer_id}` — customer detail and order history

Uploads are limited by the implementation to 25 MB. See `api.py` for request and response shapes.

## Screenshots

Existing application screenshots are in [`documentation/screenshots/`](documentation/screenshots/). The two workstation/field-documentation photos were omitted because they are not needed to understand the interface and may expose incidental personal surroundings.

## Limitations and future work

The included model and example data are synthetic. Model probabilities are estimates, not guarantees or causal effects. Performance on real data is not established by the bundled demo. Retail data without a payment-method field cannot support payment-method conclusions. Rule-based tiers and recommendations need business review. The local prototype has no authentication, persistence or message delivery. Future work could establish a redistributable real-data source, assess temporal performance on approved data, add persistent storage/access controls, and evaluate actions with appropriate outcome data; these are suggestions, not implemented features.

## License and attribution

No project license was present or added. The project owner should choose a code license before public reuse. The bundled data in this copy is generated synthetic demo data. UCI-derived files and UCI evaluation artifacts are excluded pending provenance/redistribution review; see `docs/DATASET_DECISION.md`. Check third-party frontend and Python dependency licenses separately.
