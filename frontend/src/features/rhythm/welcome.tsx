import { Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowRight,
  Upload,
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle2,
  TriangleAlert,
  XCircle,
  Check,
  Database,
  LayoutDashboard,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileFormatError, type ValidationResult } from "./validation";
import { analyseUploadedFile, ApiRequestError, loadDemoData } from "./api";
import { BrandIcon, PrimaryButton, SecondaryButton } from "./components";
import { useData, useDataLoaded, datasetSource } from "./data";

const REQUIRED_COLUMNS = [
  ["customer_id", "Customer ID"],
  ["order_id", "Order ID"],
  ["order_date", "Order date"],
  ["amount", "Order amount"],
] as const;
const COLUMN_LABELS: Record<string, string> = Object.fromEntries(REQUIRED_COLUMNS);
const OPTIONAL_COLUMNS = [
  ["order_status", "Order status"],
  ["category", "Product category"],
  ["payment_method", "Payment method"],
] as const;
for (const [key, label] of OPTIONAL_COLUMNS) COLUMN_LABELS[key] = label;
const friendlyColumn = (column: string) => COLUMN_LABELS[column] ?? column.replaceAll("_", " ");
const friendlyValidationError = (message: string) =>
  message.replace(
    /Missing required column: ([a-z_]+)/gi,
    (_, column: string) => `Missing required column: ${friendlyColumn(column)}`,
  );

export function Welcome({ initialUpload = false }: { initialUpload?: boolean }) {
  const [upload, setUpload] = useState(initialUpload);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState("");
  const [state, setState] = useState<"idle" | "selected" | "checking" | "processing" | "done">(
    "idle",
  );
  const [dragging, setDragging] = useState(false);
  const [continueOpen, setContinueOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const data = useData();
  const dataLoaded = useDataLoaded();
  const dataSource = datasetSource(data.summary.data_label);
  const connectedLabel = !dataLoaded
    ? "Not Connected"
    : dataSource === "Synthetic Demo Dataset"
      ? "Demo Data Connected"
      : "Your Data Connected";
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);

  const choose = (f?: File) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(
      fileFormatError(f.name) ??
        (f.size > 25 * 1024 * 1024
          ? "This file is larger than 25 MB. Please choose a smaller file."
          : ""),
    );
    setState("selected");
    setContinueOpen(false);
  };

  const beginUpload = () => {
    setUpload(true);
    input.current?.click();
  };

  async function exploreDemo() {
    setDemoLoading(true);
    setError("");
    try {
      const payload = await loadDemoData();
      if (!payload.ok) throw new Error("Demo data could not be loaded. Please try again.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not load demo data. Start the Python API and try again.",
      );
    } finally {
      setDemoLoading(false);
    }
  }

  async function validate() {
    if (!file || error) return;
    setState("checking");
    setError("");
    setResult(null);
    setContinueOpen(false);
    let uploadHeaders: string[] = [];
    try {
      let workbook: XLSX.WorkBook;
      try {
        workbook = XLSX.read(await file.arrayBuffer(), { type: "array", sheetRows: 1 });
      } catch {
        throw new Error("File could not be read. Upload a valid CSV or XLSX file.");
      }
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const headerRow = firstSheet
        ? (XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
            header: 1,
            blankrows: false,
            defval: "",
          })[0] ?? [])
        : [];
      const fileHeaders = headerRow.map((value) => String(value ?? "").trim());
      uploadHeaders = fileHeaders.filter(Boolean);
      if (!firstSheet || !fileHeaders.some(Boolean)) {
        throw new Error("File has no column headers. Add a header row and upload it again.");
      }
      const seen = new Set<string>();
      const duplicateHeaders = new Set<string>();
      for (const heading of fileHeaders.filter(Boolean)) {
        const normalized = heading.toLocaleLowerCase();
        if (seen.has(normalized)) duplicateHeaders.add(heading);
        seen.add(normalized);
      }
      if (duplicateHeaders.size) {
        throw new Error(
          `Duplicate column names detected: ${[...duplicateHeaders].join(", ")}. Rename the duplicate columns and upload the file again.`,
        );
      }
      setState("processing");
      const payload = await analyseUploadedFile(file);
      const v = payload.validation ?? {};
      const stats = v.stats ?? {};
      const quality = payload.analytics?.data_quality ?? {};
      const countOrNull = (value: unknown) => {
        if (value == null || value === "") return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      };
      const totalCustomers = countOrNull(payload.summary?.total_customers ?? stats.customers);
      const unscored = countOrNull(payload.summary?.not_enough_history);
      const uploadedRows = countOrNull(stats.rows ?? quality.rows_uploaded);
      const usedOrders = countOrNull(payload.summary?.total_orders ?? quality.rows_used);
      setResult({
        is_valid: v.is_valid !== false,
        errors: v.errors ?? [],
        warnings: v.warnings ?? [],
        detected: quality.available_columns ?? stats.columns_found ?? [],
        headers: fileHeaders.filter(Boolean),
        column_map: v.column_map ?? {},
        stats: {
          rows: uploadedRows,
          customers: totalCustomers,
          orders: usedOrders,
          data_label: String(payload.summary?.data_label ?? file.name),
          repeat_customers: countOrNull(stats.repeat_customers),
          scored_customers:
            totalCustomers != null && unscored != null
              ? Math.max(0, totalCustomers - unscored)
              : null,
          date_min: String(stats.date_min ?? quality.date_min ?? "") || null,
          date_max: String(stats.date_max ?? quality.date_max ?? "") || null,
          history_days: countOrNull(stats.history_days),
          missing_values: countOrNull(quality.total_missing),
          duplicates_removed: countOrNull(quality.duplicates_removed),
          cancelled_removed: countOrNull(quality.cancelled_removed),
          invalid_removed: countOrNull(quality.invalid_removed),
          quality_status: quality.quality_status ?? null,
        },
      });
      setContinueOpen(true);
      if (v.is_valid !== false) setUpload(false);
    } catch (e) {
      if (e instanceof ApiRequestError && e.validation) {
        const validation = e.validation;
        const stats = validation.stats ?? {};
        setResult({
          is_valid: false,
          errors: validation.errors?.length ? validation.errors : [e.message],
          warnings: validation.warnings ?? [],
          detected: stats.columns_found ?? [],
          headers: uploadHeaders,
          column_map: validation.column_map ?? {},
          stats: {
            rows: typeof stats.rows === "number" ? stats.rows : null,
            customers: typeof stats.customers === "number" ? stats.customers : null,
            orders: null,
            data_label: file.name,
            repeat_customers:
              typeof stats.repeat_customers === "number" ? stats.repeat_customers : null,
            scored_customers: null,
            date_min: typeof stats.date_min === "string" ? stats.date_min : null,
            date_max: typeof stats.date_max === "string" ? stats.date_max : null,
            history_days: typeof stats.history_days === "number" ? stats.history_days : null,
            missing_values: null,
            duplicates_removed: null,
            cancelled_removed: null,
            invalid_removed: null,
            rows_excluded: null,
            quality_status: "Needs attention",
          },
        });
      } else {
        setError(e instanceof Error ? e.message : "The backend could not process this file.");
      }
    } finally {
      setState("done");
    }
  }

  return (
    <div className="welcome min-h-screen bg-[var(--color-bg-app)] text-[var(--color-text-primary)]">
      <input
        type="file"
        accept=".csv,.xlsx"
        ref={input}
        className="hidden"
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      <header className="welcome-header">
        <Link to="/" onClick={() => setUpload(false)} className="welcome-project-brand">
          <BrandIcon size={36} />
          <span>Digital Payment Behaviour Analysis</span>
        </Link>
        <span className="welcome-header-descriptor">Customer behaviour analysis</span>
        <span
          className={`welcome-dataset-status${dataLoaded ? " is-connected" : ""}`}
          role="status"
          aria-live="polite"
        >
          {dataLoaded ? <Check size={13} aria-hidden="true" /> : <span aria-hidden="true" />}
          {connectedLabel}
        </span>
      </header>

      {!upload ? (
        <main className="stitch-welcome">
          <div className="stitch-welcome-content">
            <section className="stitch-welcome-hero">
              <span className="welcome-eyebrow">Customer retention intelligence</span>
              <h1>
                Know who’s coming back.
                <br />
                Act before they don’t.
              </h1>
              <p>
                Turn billing history into clear customer signals — who needs attention, why
                behaviour is changing, and what action to take next.
              </p>
              {error && (
                <p className="welcome-error" role="alert">
                  {error}
                </p>
              )}
            </section>

            <section className="stitch-entry-grid" aria-label="Choose how to begin">
              <article className="stitch-entry-card">
                <span className="stitch-entry-icon">
                  <Database size={17} />
                </span>
                <h2>Explore Demo Data</h2>
                <p>See how customer retention analysis works with prepared data.</p>
                <PrimaryButton
                  className="stitch-entry-cta"
                  onClick={exploreDemo}
                  disabled={demoLoading}
                >
                  {demoLoading ? (
                    <>
                      Loading demo data… <LoaderCircle className="welcome-spinner" size={16} />
                    </>
                  ) : (
                    <>
                      Explore Demo Data <ArrowRight className="welcome-arrow" size={16} />
                    </>
                  )}
                </PrimaryButton>
              </article>

              <article className="stitch-entry-card">
                <span className="stitch-entry-icon muted">
                  <Upload size={17} />
                </span>
                <h2>Upload Your Data</h2>
                <p>Bring your billing history and let the system analyse it automatically.</p>
                <PrimaryButton className="stitch-entry-cta" onClick={beginUpload}>
                  Upload Your Data <ArrowRight className="welcome-arrow" size={16} />
                </PrimaryButton>
              </article>

              <article
                className={`stitch-entry-card${dataLoaded ? " is-ready" : " is-disconnected"}`}
              >
                <span className="stitch-entry-icon muted">
                  <LayoutDashboard size={17} />
                </span>
                <h2>Open Analysis</h2>
                <p>Review customer retention signals and take action from your connected data.</p>
                {dataLoaded ? (
                  <PrimaryButton
                    className="stitch-entry-cta"
                    onClick={() => navigate({ to: "/overview" })}
                  >
                    Open Analysis <ArrowRight className="welcome-arrow" size={16} />
                  </PrimaryButton>
                ) : (
                  <SecondaryButton
                    className="stitch-entry-cta stitch-entry-cta-muted"
                    onClick={() => navigate({ to: "/overview" })}
                    title="No data connected yet. Open the empty analysis workspace."
                  >
                    Open Analysis <ArrowRight className="welcome-arrow" size={16} />
                  </SecondaryButton>
                )}
              </article>
            </section>

            <p className="stitch-welcome-closing">From transaction history to retention action.</p>
          </div>
        </main>
      ) : (
        <main className="upload-page max-w-4xl mx-auto px-6 py-8">
          <Button
            variant="ghost"
            className="mb-5 flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            onClick={() => setUpload(false)}
          >
            <ArrowLeft size={16} />
            Back to welcome
          </Button>

          <div className="mb-6">
            <h1 className="font-['Manrope'] text-2xl font-bold">
              Start with your transaction data
            </h1>
            <p className="subtitle text-sm text-[var(--color-text-secondary)]">
              Your file is processed by the Python retention pipeline for validation, feature
              engineering and 30-day return likelihood.
            </p>
          </div>

          <div className="upload-grid">
            <div
              className={`dropzone ${dragging ? "dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                choose(e.dataTransfer.files[0]);
              }}
            >
              <FileSpreadsheet size={36} className="text-[var(--color-brand-primary)]" />
              <h2 className="text-base font-bold mt-2">
                {file ? file.name : "Drop your dataset here"}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB · ${state === "checking" ? "Checking file headers…" : state === "processing" ? "Uploading, validating and processing…" : "Ready for analysis"}`
                  : "CSV or XLSX · up to 25 MB"}
              </p>
              <div className="flex gap-2 mt-4">
                <SecondaryButton onClick={() => input.current?.click()} size="sm">
                  <Upload size={14} />
                  {file ? "Choose another file" : "Browse Files"}
                </SecondaryButton>
                {file && (
                  <PrimaryButton
                    disabled={!!error || state === "checking" || state === "processing"}
                    onClick={validate}
                    size="sm"
                  >
                    {state === "checking"
                      ? "Checking file…"
                      : state === "processing"
                        ? "Processing dataset…"
                        : "Analyze dataset"}
                  </PrimaryButton>
                )}
              </div>
            </div>

            <section className="panel !p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Required columns
              </h2>
              <div className="required-list mt-3 flex flex-col gap-2">
                {REQUIRED_COLUMNS.map(([key, label]) => {
                  const found = result?.detected.includes(key);
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]"
                    >
                      {found === undefined ? (
                        <span aria-hidden="true">•</span>
                      ) : found ? (
                        <Check size={14} className="text-[var(--color-positive)]" />
                      ) : (
                        <XCircle size={14} className="text-[var(--color-risk)]" />
                      )}
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-border-default)]">
                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Optional columns
                </span>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Order status, product category, and payment method are used when detected. Order
                  status is optional in the current analysis pipeline.
                </p>
                {result?.column_map &&
                  Object.entries(result.column_map).some(
                    ([source, target]) => source !== target,
                  ) && (
                    <div className="mt-3" aria-label="Detected column mappings">
                      <b className="text-xs">Detected column names</b>
                      {Object.entries(result.column_map)
                        .filter(([source, target]) => source !== target)
                        .map(([source, target]) => (
                          <div className="text-xs" key={source}>
                            {source} → {friendlyColumn(target)}
                          </div>
                        ))}
                    </div>
                  )}
                {result?.is_valid &&
                  (() => {
                    const mapped = new Set(Object.keys(result.column_map ?? {}));
                    const extra = result.headers.filter((header) => !mapped.has(header));
                    return extra.length > 0 ? (
                      <div className="mt-3 text-xs" role="status">
                        <b>
                          {extra.length} additional {extra.length === 1 ? "column" : "columns"}{" "}
                          detected
                        </b>
                        <p>
                          These fields are not required for the current retention analysis and will
                          not affect its results: {extra.join(", ")}. The original uploaded file is
                          unchanged.
                        </p>
                      </div>
                    ) : null;
                  })()}
              </div>
            </section>
          </div>

          {(state === "checking" || state === "processing") && (
            <div className="loading-state upload-loading mt-4" role="status" aria-live="polite">
              <span className="loading-indicator" />
              <div>
                <b>
                  {state === "checking"
                    ? "Checking file headers"
                    : "Uploading and processing dataset"}
                </b>
                <p className="muted text-xs">
                  {state === "checking"
                    ? "Checking the file structure before sending it for analysis."
                    : "The backend is validating your records and preparing customer analysis."}
                </p>
              </div>
            </div>
          )}

          {(error || result) && (
            <section className="panel mt-6">
              <div className="panel-head">
                <div>
                  <h2>{result?.is_valid ? "Data processing summary" : "Dataset validation"}</h2>
                  <p>{file?.name} · dataset validation and customer analysis</p>
                </div>
              </div>
              {result && (
                <>
                  <div className="validation-banner mb-4">
                    {result.is_valid ? (
                      <CheckCircle2 size={18} className="text-[var(--color-positive)]" />
                    ) : (
                      <XCircle size={18} className="text-[var(--color-risk)]" />
                    )}
                    <b>{result.is_valid ? "Dataset ready" : "Dataset needs attention"}</b>
                  </div>

                  <div className="validation-stats">
                    {[
                      ["Rows uploaded", result.stats.rows],
                      ["Usable orders", result.stats.orders],
                      ["Customers detected", result.stats.customers],
                      ["Scored customers", result.stats.scored_customers],
                      ["Duplicate orders excluded", result.stats.duplicates_removed],
                      ["Cancelled orders excluded", result.stats.cancelled_removed],
                      ["Invalid rows excluded", result.stats.invalid_removed],
                      [
                        "Date range",
                        result.stats.date_min && result.stats.date_max
                          ? `${result.stats.date_min} – ${result.stats.date_max}`
                          : null,
                      ],
                      ["Data quality", result.stats.quality_status],
                    ]
                      .filter(
                        ([label, value]) =>
                          value != null &&
                          value !== "" &&
                          (!String(label).includes("excluded") || value !== 0),
                      )
                      .map(([label, value]) => (
                        <div className="metric" key={String(label)}>
                          <span>{label}</span>
                          <strong>
                            {typeof value === "number" ? value.toLocaleString() : value}
                          </strong>
                        </div>
                      ))}
                  </div>
                  {result.is_valid && (
                    <div className="mt-4" role="status">
                      <b>Required columns found</b>
                      <ul className="mt-2 list-disc pl-5">
                        {REQUIRED_COLUMNS.map(([key, label]) => (
                          <li key={key}>{label}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {(error || result?.errors.length) && (
                <div className="warning-block mt-4" role="alert">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--color-risk)]">
                    <XCircle size={16} />
                    {result?.errors.some((message) => /Missing required column:/i.test(message))
                      ? "Missing required columns"
                      : "Analysis could not continue"}
                  </h3>
                  {error && <p className="text-xs mt-1">{error}</p>}
                  {result?.errors.some((message) => /Missing required column:/i.test(message)) && (
                    <ul className="mt-2 list-disc pl-5">
                      {result.errors
                        .filter((message) => /Missing required column:/i.test(message))
                        .map((message) => (
                          <li key={message} className="text-xs">
                            {friendlyValidationError(message).replace(
                              /^Missing required column:\s*/i,
                              "",
                            )}
                          </li>
                        ))}
                    </ul>
                  )}
                  {result?.errors.map((e) =>
                    /Missing required column:/i.test(e) ? null : (
                      <p key={e} className="text-xs mt-1">
                        {friendlyValidationError(e)}
                      </p>
                    ),
                  )}
                  {result && result.detected.length > 0 && (
                    <p className="text-xs mt-3">
                      <b>Available columns:</b> {result.detected.map(friendlyColumn).join(", ")}
                    </p>
                  )}
                  {result?.errors.some((message) => /Missing required column:/i.test(message)) && (
                    <p className="text-xs mt-2">
                      Customer ID, order ID, order date, and order amount are needed to analyse
                      customer behaviour. Add the missing column(s) and upload the file again.
                    </p>
                  )}
                </div>
              )}

              {!!result?.warnings.length && (
                <div className="warning-block mt-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--color-warning)]">
                    <TriangleAlert size={16} />
                    Warnings
                  </h3>
                  {result.warnings.map((w) => (
                    <p key={w} className="text-xs mt-1">
                      {w}
                    </p>
                  ))}
                </div>
              )}

              <div className="upload-actions mt-6 flex gap-3">
                <PrimaryButton
                  disabled={!result?.is_valid || !!error}
                  onClick={() => navigate({ to: "/overview" })}
                >
                  View analysis
                  <ArrowRight size={15} />
                </PrimaryButton>
                <SecondaryButton onClick={() => input.current?.click()}>
                  Choose another file
                </SecondaryButton>
              </div>

              {continueOpen && result && (
                <div className="insight-band mt-4">
                  <div>
                    <h3 className="text-sm font-bold">Analysis ready</h3>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {result.stats.data_label}: {result.stats.customers?.toLocaleString() ?? "—"}{" "}
                      customers and {result.stats.orders?.toLocaleString() ?? "—"} usable orders.
                    </p>
                    <PrimaryButton
                      className="mt-3"
                      size="sm"
                      onClick={() => navigate({ to: "/overview" })}
                    >
                      Continue to Overview
                      <ArrowRight size={14} />
                    </PrimaryButton>
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      )}
    </div>
  );
}
