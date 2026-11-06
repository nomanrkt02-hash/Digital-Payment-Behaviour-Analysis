import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, Download, Upload, Search } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { datasetSource, statusLabel, useData, useDataLoaded } from "./data";
import { PageHeading } from "./shell";
import { updateBusinessRules } from "./api";
import { useFormat, usePreferences } from "./preferences";

const reportDriverLabels: Record<string, string> = {
  "Order gap much longer than usual": "Order gap much longer than usual",
  "Inactive for a very long time (lapsed)": "Inactive for a very long time",
  "Inactive for a very long time": "Inactive for a very long time",
  "Spending has decreased": "Spending has decreased",
  "Ordering frequency has decreased": "Ordering frequency has decreased",
};
const reportActionLabel = (value: string) =>
  value.replace(/\bVIP benefits\b/gi, "Customer recognition")
    .replace(/\bVIP\b/gi, "valued customer")
    .replace(/\bLoyalty points\b/gi, "Customer reward")
    .replace(/\bLapsed\b/gi, "Inactive");
const reportActionCopy = (value: string) =>
  reportActionLabel(value).replace(/\bRhythm\b/gi, "order pattern");

type InsightSegment = {
  kind: string;
  segment: string;
  customers: number;
  share: number | null;
  avg_order_value: number | null;
  avg_usual_interval_days: number | null;
  avg_days_since_last_order: number | null;
};
type ReportAttention = {
  customer_id: string;
  short_reason: string;
  priority: string;
  return_probability_pct: number | null;
};
export function Insights() {
  const data = useData();
  const analytics = data.analytics;
  const reasons = [...(analytics.reasons || [])]
    .sort((a, b) => Number(b.customers) - Number(a.customers))
    .slice(0, 4);
  const segments = (analytics.segments as InsightSegment[]).filter(
    (segment) => segment.kind === "status",
  );
  const actions = [...(analytics.actions || [])]
    .sort((a, b) => Number(b.customers) - Number(a.customers))
    .slice(0, 5);
  const [selectedReason, setSelectedReason] = useState<(typeof reasons)[number] | null>(null);
  const riskCount = Number(data.summary.at_risk || 0);
  const selectedAction = actions[0];
  return (
    <>
      <PageHeading
        title="Insights"
        subtitle="Why customers are at risk — and what action is most useful."
      />
      <section className="insight-signals" aria-label="Key signals">
        <div className="panel insight-signal">
          <span className="muted">Top risk driver</span>
          <b>{reasons[0]?.reason || "Not available"}</b>
          <span>{Number(reasons[0]?.customers || 0).toLocaleString()} customers</span>
        </div>
        <div className="panel insight-signal">
          <span className="muted">Most affected group</span>
          <b>At Risk</b>
          <span>{riskCount.toLocaleString()} customers</span>
        </div>
        <div className="panel insight-signal">
          <span className="muted">Top recommended action</span>
          <b>{selectedAction?.action_type || "Not available"}</b>
          <span>{Number(selectedAction?.customers || 0).toLocaleString()} customers</span>
        </div>
      </section>
      <div className="insight-compact-grid">
        <section className="panel insight-compact-section">
          <div className="band-title">
            <span className="band-number">01</span>
            <h2>Risk drivers</h2>
          </div>
          <ol className="insight-ranked-list">
            {reasons.map((reason, index) => (
              <li key={reason.reason}>
                <span className="insight-rank">{index + 1}</span>
                <button
                  type="button"
                  className="insight-driver-button"
                  aria-expanded={selectedReason?.reason === reason.reason}
                  onClick={() =>
                    setSelectedReason(selectedReason?.reason === reason.reason ? null : reason)
                  }
                >
                  <span>{reason.reason}</span>
                  <b>{Number(reason.customers).toLocaleString()}</b>
                </button>
              </li>
            ))}
          </ol>
          {selectedReason && (
            <div className="insight-driver-detail" role="region" aria-live="polite">
              <b>{selectedReason.reason}</b>
              <span>
                {Number(selectedReason.customers).toLocaleString()} customers show this pattern.
              </span>
              <span>Recommended response: {selectedAction?.action_type || "Review customer"}</span>
              <Link
                className="text-link"
                to="/customers"
                search={{ status: "At Risk", reason: selectedReason.reason }}
              >
                View Customers <ArrowUpRight size={14} />
              </Link>
            </div>
          )}
          <Link className="text-link" to="/customers" search={{ status: "At Risk" }}>
            View at-risk customers <ArrowUpRight size={14} />
          </Link>
        </section>
        <section className="panel insight-compact-section">
          <div className="band-title">
            <span className="band-number">02</span>
            <h2>Customer groups</h2>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Customers</th>
                  <th>Average interval</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment) => (
                  <tr key={segment.segment}>
                    <td>
                      <Link to="/customers" search={{ status: segment.segment }}>
                        {segment.segment}
                      </Link>
                    </td>
                    <td>
                      <Link to="/customers" search={{ status: segment.segment }}>
                        {Number(segment.customers).toLocaleString()}
                      </Link>
                    </td>
                    <td>
                      {segment.avg_usual_interval_days == null
                        ? "Not established"
                        : `${Number(segment.avg_usual_interval_days).toFixed(0)} days`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section className="panel insight-compact-section insight-actions">
        <div className="band-title">
          <span className="band-number">03</span>
          <h2>Recommended actions</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Customers</th>
                <th>High priority</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.action_type}>
                  <td>{action.action_type}</td>
                  <td>{Number(action.customers).toLocaleString()}</td>
                  <td>
                    {Number(action.high_priority || 0).toLocaleString()}
                    <Link className="text-link ml-3" to="/customers" search={{ status: "At Risk" }}>
                      View audience <ArrowUpRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
export function Transactions() {
  const SAMPLE_DATA = useData();
  const sampleTransactions = SAMPLE_DATA.orders || [];
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const { money, date } = useFormat();
  const { preferences } = usePreferences();
  const q = SAMPLE_DATA.analytics.data_quality;
  const filtered = sampleTransactions.filter((t) =>
    `${t.customer_id} ${t.order_id} ${t.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  const size = preferences.rowsPerPage;
  const coverage = q.date_min && q.date_max ? `${q.date_min} – ${q.date_max}` : "Not available";
  const tiles = [
    [
      "Customers analysed",
      Number(q.customers || SAMPLE_DATA.summary.total_customers || 0).toLocaleString(),
    ],
    [
      "Transactions used",
      Number(q.rows_used || SAMPLE_DATA.summary.total_orders || 0).toLocaleString(),
    ],
    ["Rows uploaded", Number(q.rows_uploaded || 0).toLocaleString()],
    ["Date coverage", coverage],
  ];
  return (
    <>
      <PageHeading
        title="Data"
        subtitle="Review the active dataset, its quality and the transactions behind this analysis."
      >
        <Button asChild variant="outline">
          <Link to="/" search={{ upload: true }}>
            <Upload />
            Replace dataset
          </Link>
        </Button>
      </PageHeading>
      <div className="dataset-identity">
        <div>
          <span className="muted">Active dataset</span>
          <strong>{SAMPLE_DATA.summary.data_label || "Not available"}</strong>
          <span className="muted">Source: {datasetSource(SAMPLE_DATA.summary.data_label)}</span>
        </div>
        <span className={`quality-pill ${q.quality_status === "Good" ? "good" : "review"}`}>
          {q.quality_status || "Quality not available"}
        </span>
      </div>
      <div className="data-quality-grid">
        {tiles.map(([label, value]) => (
          <div className="panel" key={label}>
            <span className="muted text-[13px]">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {(q.warnings || []).length > 0 && (
        <div className="warning-block">
          <h3>Data quality warnings</h3>
          {(q.warnings || []).map((w: string) => (
            <p className="muted" key={w}>
              {w}
            </p>
          ))}
        </div>
      )}
      <details className="quality-details quality-details-panel">
        <summary>Quality details and available columns</summary>
        <p>
          Not scored for insufficient history:{" "}
          {SAMPLE_DATA.summary.not_enough_history ?? "Not available"}
        </p>
        <p>
          Missing values: {q.total_missing ?? "Not available"} · Duplicates removed:{" "}
          {q.duplicates_removed ?? "Not available"} · Cancelled removed:{" "}
          {q.cancelled_removed ?? "Not available"} · Invalid removed:{" "}
          {q.invalid_removed ?? "Not available"}
        </p>
        <p>Available columns: {(q.available_columns || []).join(", ") || "Not available"}</p>
      </details>
      <section className="panel table-panel">
        <div className="panel-head p-5">
          <div>
            <h2>Transaction preview</h2>
            <p>
              {sampleTransactions.length.toLocaleString()} processed transactions from the active
              dataset
            </p>
          </div>
        </div>
        <div className="search-box mx-5 mb-5">
          <Search />
          <input
            placeholder="Search customer, order or category…"
            aria-label="Search transactions"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "customer_id",
                  "order_id",
                  "order_date",
                  "amount",
                  "category",
                  "payment_method",
                ].map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(page * size, (page + 1) * size).map((t) => (
                <tr key={t.order_id}>
                  <td>{t.customer_id}</td>
                  <td>{t.order_id}</td>
                  <td>{date(t.order_date)}</td>
                  <td>{money(t.amount)}</td>
                  <td>{t.category}</td>
                  <td>{t.payment_method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <h3>No transactions match</h3>
          </div>
        )}
        <div className="table-bottom">
          <span className="muted">{filtered.length.toLocaleString()} matching transactions</span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={(page + 1) * size >= filtered.length}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success("Report downloaded");
}
export function Reports() {
  const data = useData();
  const formatting = useFormat();
  const reportSections = [
    "Summary",
    "Risk drivers",
    "Segments",
    "Recommended actions",
    "Customer list",
  ];
  const [includedSections, setIncludedSections] = useState<string[]>(reportSections);
  const [exportFormat, setExportFormat] = useState("PDF");
  const sourceName =
    String(data.summary.data_label || "customer-analysis")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "customer-analysis";
  const reasons = (data.analytics.reasons || [])
    .filter((reason) => Boolean(reportDriverLabels[reason.reason]))
    .map((reason) => ({ ...reason, displayReason: reportDriverLabels[reason.reason] || reason.reason }));
  const actions = (data.analytics.actions || []).slice(0, 3);
  const valueRows = (data.analytics.segments as InsightSegment[]).filter(
    (segment) => segment.kind === "value",
  );
  const attention = (data.analytics.attention || []) as ReportAttention[];
  const statusRows = data.analytics.status_distribution || [];
  const summaryRows = [
    { measure: "Total customers", value: data.summary.total_customers },
    { measure: "At risk", value: data.summary.at_risk },
    { measure: "Active", value: data.summary.active },
    { measure: "Loyal", value: data.summary.loyal },
    { measure: "Not scored", value: data.summary.not_enough_history },
    { measure: "30-day return probability", value: data.summary.avg_return_probability == null ? "Not available" : `${Math.round(Number(data.summary.avg_return_probability) * 100)}%` },
    { measure: "Transactions", value: data.summary.total_orders },
  ];
  const riskRows = reasons.map((reason) => ({ driver: reason.displayReason, customers: reason.customers }));
  const segmentRows = valueRows.map((segment) => ({
    "Value Tier": segment.segment,
    customers: segment.customers,
    "Average order amount": segment.avg_order_value,
  }));
  const actionRows = actions.map((action) => ({
    action: reportActionLabel(action.action_type),
    customers: action.customers,
    "High priority": action.high_priority,
  }));
  const listRows = attention.map((customer) => ({
    customer_id: customer.customer_id,
    status: "At risk",
    priority: customer.priority,
    reason: reportDriverLabels[customer.short_reason] || reportActionCopy(customer.short_reason),
    return_probability_30d: customer.return_probability_pct,
  }));
  const reportTables: Record<string, { title: string; rows: Record<string, unknown>[] }> = {
    Summary: { title: "Summary", rows: summaryRows },
    "Risk drivers": { title: "Risk drivers", rows: riskRows },
    Segments: { title: "Segments", rows: segmentRows },
    "Recommended actions": { title: "Recommended actions", rows: actionRows },
    "Customer list": { title: "Customer list", rows: listRows },
  };
  function excel() {
    const wb = XLSX.utils.book_new();
    includedSections.forEach((section) => {
      const sheet = reportTables[section];
      if (sheet) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet.rows), section);
    });
    XLSX.writeFile(wb, `${sourceName}-analysis.xlsx`);
    toast.success("Report downloaded");
  }
  function csv() {
    const rows = includedSections.flatMap((section) => {
      const report = reportTables[section];
      return report ? report.rows.map((row) => ({ Section: section, ...row })) : [];
    });
    download(
      new Blob([XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows))], {
        type: "text/csv;charset=utf-8",
      }),
      `${sourceName}-report.csv`,
    );
  }
  function pdf() {
    const lines = ["Digital Payment Behaviour Analysis", "Retention Analysis Report", ...includedSections.flatMap((section) => {
      const report = reportTables[section];
      if (!report) return [];
      return [report.title, ...report.rows.map((row) => Object.entries(row).map(([key, value]) => `${key}: ${String(value ?? "Not available")}`).join(" | "))];
    })];
    const wrapped = lines
      .flatMap((line) => line.match(/.{1,92}(?:\s|$)/g) || [line])
      .map((line) => line.trim());
    const pages: string[][] = [];
    for (let i = 0; i < wrapped.length; i += 48) pages.push(wrapped.slice(i, i + 48));
    const clean = (s: string) =>
      s
        .normalize("NFKD")
        .replace(/[^\x20-\x7E]/g, "?")
        .replace(/([\\()])/g, "\\$1");
    const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", ""];
    const pageRefs: string[] = [];
    pages.forEach((page, i) => {
      const pageObj = 3 + i * 2,
        contentObj = pageObj + 1;
      pageRefs.push(`${pageObj} 0 R`);
      const stream = `BT /F1 10 Tf 48 790 Td 14 TL ${page.map((line, n) => `${n ? "T* " : ""}(${clean(line)}) Tj`).join(" ")} ET`;
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${contentObj} 0 R >>`,
      );
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });
    objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pages.length} >>`;
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    let body = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((obj, i) => {
      offsets.push(body.length);
      body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xref = body.length;
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      body += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    download(new Blob([body], { type: "application/pdf" }), `${sourceName}-report.pdf`);
  }
  function html() {
    const esc = (x: unknown) =>
      String(x)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const table = (rows: Record<string, unknown>[]) =>
      `<table><thead><tr>${Object.keys(rows[0] ?? {})
        .map((k) => `<th>${esc(k)}</th>`)
        .join("")}</tr></thead><tbody>${rows
        .map(
          (r) =>
            `<tr>${Object.values(r)
              .map((v) => `<td>${esc(v)}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody></table>`;
    const sections = includedSections
      .map((section) => reportTables[section])
      .filter((section): section is { title: string; rows: Record<string, unknown>[] } => Boolean(section));
    download(
      new Blob(
        [
          `<!doctype html><html><head><meta charset="utf-8"><title>Retention Analysis Report — ${esc(data.summary.data_label)}</title><style>body{font:14px system-ui;max-width:1100px;margin:40px auto;padding:20px;color:#202B2A}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #E1E5E2;padding:10px;text-align:left}h2{margin-top:36px}</style></head><body><h1>Digital Payment Behaviour Analysis</h1><h2>Retention Analysis Report</h2><p>Dataset: ${esc(data.summary.data_label)} · Snapshot ${esc(data.summary.snapshot_date)}</p>${sections.map((s) => `<h2>${s.title}</h2>${table(s.rows)}`).join("")}</body></html>`,
        ],
        { type: "text/html;charset=utf-8" },
      ),
      `${sourceName}-summary.html`,
    );
  }
  const totalRisk = Number(data.summary.at_risk || 0);
  const toggleSection = (section: string) =>
    setIncludedSections((current) =>
      current.includes(section) ? current.filter((s) => s !== section) : [...current, section],
    );
  const downloadReport = () => {
    if (exportFormat === "PDF") pdf();
    else if (exportFormat === "Excel") excel();
    else if (exportFormat === "HTML") html();
    else csv();
  };
  return (
    <div className="stitch-report-page">
      <PageHeading
        title="Reports"
        subtitle="Build a focused view of customer retention performance"
      />
      <div className="stitch-report-grid">
        <aside className="stitch-report-controls">
          <section className="panel stitch-format-panel">
            <span className="stitch-eyebrow">Export format</span>
            <p>Standardized report ready for review or further analysis.</p>
            <div className="stitch-format-options">
              {["PDF", "Excel", "HTML", "CSV"].map((format) => (
                <button
                  key={format}
                  type="button"
                  className={exportFormat === format ? "is-selected" : ""}
                  onClick={() => setExportFormat(format)}
                >
                  {format}
                </button>
              ))}
            </div>
          </section>
          <section className="panel stitch-section-picker">
            <div className="stitch-picker-heading">
              <b>Include report sections</b>
              <button type="button" onClick={() => setIncludedSections(reportSections)}>
                Select all
              </button>
              <span>·</span>
              <button type="button" onClick={() => setIncludedSections([])}>
                Deselect all
              </button>
            </div>
            {reportSections.map((section, i) => (
              <label className="stitch-section-choice" key={section}>
                <input
                  type="checkbox"
                  checked={includedSections.includes(section)}
                  onChange={() => toggleSection(section)}
                />
                <span>
                  <b>
                    {i + 1}. {section}
                  </b>
                  <small>
                    {section === "Summary"
                      ? "Customer status and return outlook"
                      : section === "Risk drivers"
                        ? "Approved behaviour patterns from the active analysis"
                        : section === "Segments"
                          ? "Available customer value segmentation"
                          : section === "Recommended actions"
                            ? "Current customer recommendations"
                            : "Customers requiring attention"}
                  </small>
                </span>
              </label>
            ))}
          </section>
          <section className="stitch-report-scope">
            <span>Dataset scope</span>
            <b>{data.summary.data_label || "Not available"}</b>
            <span>Snapshot</span>
            <b>{data.summary.snapshot_date || "Not available"}</b>
            <span>Customer sample</span>
            <b>{Number(data.summary.total_customers || 0).toLocaleString()}</b>
            <span>Transactions</span>
            <b>{Number(data.summary.total_orders || 0).toLocaleString()}</b>
          </section>
          <Button className="stitch-download-report" onClick={downloadReport} disabled={!includedSections.length}>
            <Download size={16} /> Download {exportFormat}
          </Button>
          <button className="stitch-print-report" type="button" onClick={() => window.print()}>
            Print view
          </button>
        </aside>
        <article className="stitch-report-preview">
          <header className="stitch-report-cover">
            <span>Retention Analysis Report</span>
            <small>Analysis report</small>
            <h2>Digital Payment Behaviour Analysis</h2>
            <p>Customer retention and behaviour summary</p>
            <small>
              {data.summary.date_min || ""} – {data.summary.date_max || ""}
            </small>
          </header>
          {includedSections.includes("Summary") && (
            <section className="stitch-report-section">
              <div className="stitch-report-section-title">1. Summary</div>
              <div className="stitch-report-kpis">
                {[
                  ["Total customers", data.summary.total_customers],
                  ["Identified at risk", data.summary.at_risk],
                  [
                    "30-day return probability",
                    data.summary.avg_return_probability == null
                      ? null
                      : `${Math.round(Number(data.summary.avg_return_probability) * 100)}%`,
                  ],
                  ["Usable orders", data.summary.total_orders],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <small>{label}</small>
                    <b>
                      {value == null
                        ? "—"
                        : typeof value === "number"
                          ? value.toLocaleString()
                          : value}
                    </b>
                  </div>
                ))}
              </div>
              <div className="stitch-report-status">
                {statusRows.map((row: { status: string; customers: number }) => (
                  <span key={row.status}>
                    {statusLabel(row.status)}: {Number(row.customers).toLocaleString()}
                  </span>
                ))}
              </div>
            </section>
          )}
          {includedSections.includes("Risk drivers") && (
            <section className="stitch-report-section">
              <div className="stitch-report-section-title">2. Risk drivers</div>
              {reasons.map((r: { reason: string; displayReason: string; customers: number }) => (
                <div className="stitch-report-driver" key={r.reason}>
                  <span>{r.displayReason}</span>
                  <b>{Number(r.customers).toLocaleString()} customers</b>
                  <div>
                    <i
                      style={{
                        width: `${totalRisk ? Math.min(100, (Number(r.customers) / totalRisk) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </section>
          )}
          {includedSections.includes("Segments") && valueRows.length > 0 && (
            <section className="stitch-report-section">
              <div className="stitch-report-section-title">3. Segments</div>
              <div className="stitch-report-value-grid">
                {valueRows.map((r: InsightSegment) => (
                  <div key={r.segment}>
                    <small>{r.segment}</small>
                    <b>{Number(r.customers).toLocaleString()} customers</b>
                    <span>
                      {r.avg_order_value == null
                        ? ""
                        : `Average order ${formatting.money(Number(r.avg_order_value))}`}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {includedSections.includes("Recommended actions") && (
            <section className="stitch-report-section">
              <div className="stitch-report-section-title">
                4. Recommended actions
              </div>
              <div className="stitch-report-actions">
                {actions.map(
                  (a: { action_type: string; customers: number; high_priority: number }) => (
                    <div key={a.action_type}>
                      <b>{reportActionLabel(a.action_type)}</b>
                      <span>{Number(a.customers).toLocaleString()} customers</span>
                      <small>{Number(a.high_priority).toLocaleString()} high priority</small>
                    </div>
                  ),
                )}
              </div>
            </section>
          )}
          {includedSections.includes("Customer list") && (
            <section className="stitch-report-section">
              <div className="stitch-report-section-title">
                5. Customer list
              </div>
              <div className="stitch-report-table-wrap">
                <table className="stitch-report-table">
                  <thead>
                    <tr>
                      <th>Customer ID</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Reason</th>
                      <th>30-day prob.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attention.slice(0, 8).map((row) => (
                      <tr key={row.customer_id}>
                        <td>{row.customer_id}</td>
                        <td>At Risk</td>
                        <td>{row.priority}</td>
                        <td>{reportDriverLabels[row.short_reason] || reportActionCopy(row.short_reason)}</td>
                        <td>
                          {row.return_probability_pct == null
                            ? "—"
                            : `${row.return_probability_pct}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {includedSections.length === 0 && (
            <div className="stitch-report-empty">
              Select at least one section to build your report preview.
            </div>
          )}
          <footer className="stitch-report-footer">
            Retention analytics · Generated from the active dataset · Return probabilities are
            estimates
          </footer>
        </article>
      </div>
    </div>
  );
}
export function SettingsPage() {
  const data = useData();
  const dataLoaded = useDataLoaded();
  const { preferences: p, setPreferences } = usePreferences();
  const [draft, setDraft] = useState(p);
  const [saving, setSaving] = useState(false);
  const dirty =
    draft.currency !== p.currency ||
    draft.dateDisplay !== p.dateDisplay ||
    draft.rowsPerPage !== p.rowsPerPage ||
    draft.maxDiscount !== p.maxDiscount ||
    draft.allowDiscounts !== p.allowDiscounts;
  const save = async () => {
    setSaving(true);
    try {
      if (
        draft.currency !== p.currency ||
        draft.maxDiscount !== p.maxDiscount ||
        draft.allowDiscounts !== p.allowDiscounts
      ) {
        await updateBusinessRules({
          currency: draft.currency,
          max_discount: draft.maxDiscount,
          allow_discounts: draft.allowDiscounts,
        });
      }
      setPreferences(draft);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="stitch-settings-page">
      <PageHeading title="Settings" subtitle="Configure display preferences and business rules" />
      <div className="stitch-settings-grid">
        <div className="stitch-settings-left">
          <section className="panel stitch-settings-card">
            <div className="stitch-settings-card-head">
              <span>☷</span>
              <div>
                <h2>Display preferences</h2>
                <p>These settings control how values and tables are shown in the workspace.</p>
              </div>
            </div>
            <div className="stitch-setting-line">
              <div>
                <b>Currency</b>
                <span>Used to display analysis values</span>
              </div>
              <span className="stitch-setting-value" aria-label="Currency">
                ₹ Indian rupee
              </span>
            </div>
            <div className="stitch-setting-line">
              <div>
                <b>Date format</b>
                <span>Used across customer and transaction views</span>
              </div>
              <select
                aria-label="Date display"
                value={draft.dateDisplay}
                onChange={(e) => setDraft({ ...draft, dateDisplay: e.target.value })}
              >
                <option>DD MMM YYYY</option>
                <option>YYYY-MM-DD</option>
              </select>
            </div>
            <div className="stitch-setting-line">
              <div>
                <b>Rows per page</b>
                <span>Controls customer and transaction table density</span>
              </div>
              <select
                aria-label="Rows per page"
                value={draft.rowsPerPage}
                onChange={(e) => setDraft({ ...draft, rowsPerPage: Number(e.target.value) })}
              >
                {[10, 25, 50, 100].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
          </section>
        </div>
        <section className="panel stitch-settings-card">
          <div className="stitch-settings-card-head">
            <span>☷</span>
            <div>
              <h2>Business rules</h2>
              <p>These settings control how retention actions are prepared.</p>
            </div>
          </div>
          <div className="stitch-rule-box">
            <div className="stitch-rule-title">
              <b>Allow discounts</b>
              <span className="stitch-settings-switch-control">
                <Switch
                  aria-label="Allow discounts"
                  checked={draft.allowDiscounts}
                  onCheckedChange={(v) => setDraft({ ...draft, allowDiscounts: v })}
                />
                <span role="status">{draft.allowDiscounts ? "On" : "Off"}</span>
              </span>
            </div>
            <p>When enabled, recommendations may include discounts within this limit.</p>
          </div>
          <div className="stitch-rule-box">
            <div className="stitch-rule-title">
              <b>Maximum discount %</b>
              <strong>{draft.maxDiscount}%</strong>
            </div>
            <input
              className="stitch-discount-slider"
              aria-label="Maximum discount percentage"
              type="range"
              min={0}
              max={100}
              disabled={!draft.allowDiscounts}
              value={draft.maxDiscount}
              onChange={(e) => setDraft({ ...draft, maxDiscount: Number(e.target.value) })}
            />
            <div className="stitch-rule-cap">
              Offers are capped at {draft.maxDiscount}% of historical average order value.
            </div>
          </div>
          {dirty && (
            <Button className="stitch-settings-save" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          )}
        </section>
        <section className="panel stitch-settings-card stitch-settings-dataset">
          <div className="stitch-settings-card-head">
            <span>◉</span>
            <div>
              <h2>Dataset</h2>
              <p>Manage the dataset connected to this workspace.</p>
            </div>
          </div>
          <div className="stitch-settings-dataset-row">
            <div>
              <b>Current dataset</b>
              <span>{dataLoaded ? data.summary.data_label || "Active dataset" : "No dataset loaded"}</span>
            </div>
            <Button asChild variant="outline">
              <Link to="/" search={{ upload: true }}>
                Change dataset
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
