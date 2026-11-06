# UI ↔ Backend integration

The production UI in `frontend/` is a React/TanStack application. It talks to `api.py` (FastAPI). The React UI must not reimplement model logic.

## API endpoints

- `GET /api/health` — service health.
- `GET /api/current` — currently processed dataset result held in server memory.
- `POST /api/demo` — process the clearly labelled synthetic demo dataset.
- `POST /api/analyze` — multipart upload (`file`, CSV/XLSX), validate, clean, build features, train a model on that uploaded dataset, predict and return the active result.
- `GET /api/customer/{customer_id}` — detail data and real order history for a customer.

## Main result contract

`summary`, `customers`, `orders`, `analytics`, `validation`, `cleaning_report`, `model_info`, and `notes` are returned as JSON. The UI uses these values for Overview, Customer Analytics, Customer Detail, Retention Insights, Customer Segments, Transaction Data, Reports and Settings.

Demo and uploaded data both go through `src/prediction_pipeline.py`. Upload analysis uses strict training: if the uploaded data cannot support a valid time-based training/test process, the API returns a readable error rather than silently falling back to the synthetic demo-trained model.

## Local development

Terminal 1 (project root):

```bash
uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`.
