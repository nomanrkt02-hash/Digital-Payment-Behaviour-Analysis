import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Database,
  Download,
  Search,
  ShoppingCart,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData, type Transaction } from "./data";
import { useFormat, usePreferences } from "./preferences";

type MonthlyActivity = {
  month: string;
  orders?: number;
  active_customers?: number;
  revenue?: number;
};
const EMPTY_TRANSACTIONS: Transaction[] = [];
const count = (value: unknown) => Number(value || 0).toLocaleString();
const monthName = (month: string) =>
  new Date(`${month}-01`).toLocaleDateString("en", { month: "short", timeZone: "UTC" });
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function StitchData() {
  const data = useData();
  const transactions = (data.orders || EMPTY_TRANSACTIONS) as Transaction[];
  const quality = data.analytics.data_quality;
  const activity = (data.analytics.monthly_activity || []) as MonthlyActivity[];
  const columns = (quality.available_columns || []).map((column) => String(column));
  const { money, date } = useFormat();
  const { preferences } = usePreferences();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(0);
  const rows = useMemo(
    () =>
      transactions.filter((transaction) => {
        const haystack =
          `${transaction.customer_id} ${transaction.order_id} ${transaction.category || ""} ${transaction.payment_method || ""}`.toLowerCase();
        return (
          haystack.includes(query.toLowerCase()) &&
          (!status || String(transaction.order_status || "") === status) &&
          (!month || transaction.order_date.startsWith(month))
        );
      }),
    [transactions, query, status, month],
  );
  const pageSize = preferences.rowsPerPage;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const maxOrders = Math.max(1, ...activity.map((item) => Number(item.orders || 0)));
  const statusOptions = [
    ...new Set(
      transactions.map((transaction) => String(transaction.order_status || "")).filter(Boolean),
    ),
  ];
  const hasOrderStatus = statusOptions.length > 0;
  const uploaded = quality.rows_uploaded;
  const used = quality.rows_used ?? data.summary.total_orders;
  const customers = quality.customers ?? data.summary.total_customers;
  const scored = Math.max(
    0,
    Number(data.summary.total_customers || 0) - Number(data.summary.not_enough_history || 0),
  );
  const coverage =
    quality.date_min && quality.date_max
      ? `${quality.date_min} – ${quality.date_max}`
      : "Not available";
  const requiredColumns = [
    ["customer_id", "Customer ID"],
    ["order_id", "Order ID"],
    ["order_date", "Order date"],
    ["amount", "Order amount"],
  ];
  const requiredNames = new Set(requiredColumns.map(([key]) => key));
  const extraColumns = columns.filter((column) => !requiredNames.has(column));
  const removalSummary = [
    quality.duplicates_removed == null
      ? null
      : `${count(quality.duplicates_removed)} duplicate orders excluded`,
    quality.invalid_removed == null
      ? null
      : `${count(quality.invalid_removed)} invalid rows excluded`,
    quality.cancelled_removed == null
      ? null
      : `${count(quality.cancelled_removed)} cancelled orders excluded`,
  ].filter(Boolean);

  const exportCsv = () => {
    const exportColumns: (keyof Transaction)[] = [
      "order_id",
      "customer_id",
      "order_date",
      "amount",
      "payment_method",
      "order_status",
      "category",
    ];
    const content = [
      exportColumns.join(","),
      ...rows.map((transaction) => exportColumns.map((key) => csvCell(transaction[key])).join(",")),
    ].join("\r\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${String(data.summary.data_label || "transactions")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stitch-data-page">
      <header className="stitch-data-header">
        <div>
          <h1>Data</h1>
          <p>Dataset health and transaction overview</p>
        </div>
        <div className="stitch-data-header-actions">
          <span className="stitch-data-source">
            <i />
            {data.summary.data_label || "Active dataset"}
          </span>
          <span className="stitch-data-quality-pill">
            <Check size={14} />
            {quality.quality_status || "Quality status unavailable"}
          </span>
          <Button asChild>
            <Link to="/" search={{ upload: true }}>
              <Upload size={15} /> Change dataset
            </Link>
          </Button>
        </div>
      </header>

      <section className="stitch-data-journey">
        <div className="stitch-data-section-title">
          <h2>
            <Database size={15} /> Data journey
          </h2>
          <span>Data status · {quality.quality_status || "Not provided"}</span>
        </div>
        <div className="stitch-data-journey-grid">
          {[
            {
              title: "Upload",
              value: uploaded,
              note: removalSummary.slice(0, 2).join(" · ") || "Uploaded rows received",
            },
            {
              title: "Order checks",
              value: used,
              note: removalSummary[2] || "Usable orders prepared",
            },
            { title: "Customer history", value: customers, note: "Customers in active analysis" },
            {
              title: "Retention analysis",
              value: scored,
              note:
                data.summary.avg_return_probability == null
                  ? "Return estimate not provided"
                  : `Average return estimate ${Math.round(Number(data.summary.avg_return_probability) * 100)}%`,
              current: true,
            },
          ].map((step, index) => (
            <article
              key={step.title}
              className={`stitch-data-step${step.current ? " current" : ""}`}
            >
              <div>
                <small>
                  Step {index + 1} · {step.title}
                </small>
                <span>{index + 1}</span>
              </div>
              <strong>{step.value == null ? "—" : count(step.value)}</strong>
              <b>
                {step.title === "Customer history"
                  ? "Customers"
                  : step.title === "Retention analysis"
                    ? "Scored"
                    : "Rows"}
              </b>
              <p>{step.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="stitch-data-info-grid">
        <article className="stitch-data-panel stitch-data-columns">
          <div className="stitch-data-section-title">
            <div>
              <h2>
                <Database size={15} /> Columns in this dataset
              </h2>
              <p>Required fields and additional fields detected in the uploaded data.</p>
            </div>
            <span>{columns.length} detected</span>
          </div>
          <div className="stitch-detected-columns">
            {columns.length ? (
              requiredColumns.map(([column, label]) => (
                <span key={column}>
                  <Check size={12} />
                  {label}
                </span>
              ))
            ) : (
              <p>Column details are not available for this dataset.</p>
            )}
          </div>
          {extraColumns.length > 0 && (
            <div className="stitch-column-coverage">
              <strong>Additional detected columns</strong>
              <span>{extraColumns.map((column) => column.replaceAll("_", " ")).join(" · ")}</span>
              <span>Additional fields are not required for the current retention analysis.</span>
            </div>
          )}
          {columns.length > 0 && (
            <div className="stitch-column-coverage">
              <span>Required fields are available for this analysis.</span>
              <span>Column information comes from the active dataset report.</span>
            </div>
          )}
        </article>
        <article className="stitch-data-panel stitch-quality-panel">
          <div className="stitch-data-section-title">
            <h2>
              <ShoppingCart size={15} /> Data quality
            </h2>
            <span className="stitch-quality-status">
              {quality.quality_status || "Status unavailable"}
            </span>
          </div>
          {[
            ["Duplicates removed", quality.duplicates_removed],
            ["Cancelled orders removed", quality.cancelled_removed],
            ["Invalid rows removed", quality.invalid_removed],
            ["Missing values", quality.total_missing],
          ].map(([label, value]) => (
            <div className="stitch-quality-row" key={String(label)}>
              <div>
                <span>{label}</span>
                <b>{value == null ? "Not provided" : count(value)}</b>
              </div>
              {value != null && Number(value) === 0 && (
                <span className="stitch-quality-clean">Clean</span>
              )}
            </div>
          ))}
          {(quality.quality_status || "").toLowerCase().includes("warning") && (
            <p className="stitch-quality-warning">
              <CircleAlert size={13} />
              Review the quality warnings provided by the active analysis.
            </p>
          )}
        </article>
      </section>

      <section className="stitch-data-panel stitch-cadence-chart-panel">
        <div className="stitch-data-section-title">
          <div>
            <h2>
              <BarChart3 size={15} /> Monthly order cadence
            </h2>
            <p>{coverage} · Select a month to filter transaction records</p>
          </div>
          <div className="stitch-chart-total">
            Total volume · {count(data.summary.total_orders)} orders
          </div>
        </div>
        {activity.length ? (
          <div className="stitch-monthly-bars">
            {activity.map((item) => (
              <button
                key={item.month}
                type="button"
                aria-pressed={month === item.month}
                className={month === item.month ? "selected" : ""}
                title={`${monthName(item.month)} · ${count(item.orders)} orders${item.active_customers == null ? "" : ` · ${count(item.active_customers)} active customers`}`}
                onClick={() => {
                  setMonth(month === item.month ? "" : item.month);
                  setPage(0);
                }}
              >
                <i
                  style={{
                    height: `${Math.max(4, (Number(item.orders || 0) / maxOrders) * 100)}%`,
                  }}
                />
                <span>{monthName(item.month)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="stitch-data-empty">
            Monthly order cadence is not available for this dataset.
          </div>
        )}
        <div className="stitch-chart-foot">
          <span>
            {month ? `Filtered to ${monthName(month)}` : "Monthly activity from the analysis"}
          </span>
          <span>
            {month && (
              <button
                type="button"
                onClick={() => {
                  setMonth("");
                  setPage(0);
                }}
              >
                Reset month filter
              </button>
            )}
          </span>
        </div>
      </section>

      <section className="stitch-data-panel stitch-transactions-panel">
        <div className="stitch-data-section-title">
          <div>
            <h2>
              <Database size={15} /> Transactions
            </h2>
            <p>
              {count(rows.length)} usable order records{month ? ` · ${monthName(month)}` : ""}
            </p>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download size={14} /> Export CSV
          </Button>
        </div>
        <div className="stitch-transaction-controls">
          <label>
            <Search size={15} />
            <input
              aria-label="Search transactions"
              placeholder="Search order ID, customer ID or category…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <span className="stitch-observation-window">
            <CalendarDays size={14} />
            {coverage}
          </span>
          {hasOrderStatus && (
            <select
              aria-label="Filter transaction status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(0);
              }}
            >
              <option value="">All statuses</option>
              {statusOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          )}
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table className="stitch-transactions-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer ID</th>
                  <th>Order date</th>
                  <th>Amount ({preferences.currency})</th>
                  <th>Payment method</th>
                  {hasOrderStatus && <th>Status</th>}
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                  .map((transaction) => (
                    <tr key={transaction.order_id}>
                      <td>{transaction.order_id}</td>
                      <td>
                        <Link
                          to="/customers/$customerId"
                          params={{ customerId: transaction.customer_id }}
                        >
                          {transaction.customer_id}
                        </Link>
                      </td>
                      <td>{date(transaction.order_date)}</td>
                      <td>{money(Number(transaction.amount || 0))}</td>
                      <td>{transaction.payment_method || "Not provided"}</td>
                      {hasOrderStatus && (
                        <td>
                          <span className="stitch-order-status">{transaction.order_status}</span>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="stitch-data-empty">No transactions match this search or filter.</div>
        )}
        <div className="stitch-data-pagination">
          <span>
            Showing{" "}
            {rows.length
              ? `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, rows.length)}`
              : "0"}{" "}
            of {count(rows.length)} orders
          </span>
          <div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={14} />
            </Button>
            {Array.from({ length: Math.min(3, pageCount) }, (_, index) => (
              <Button
                key={index}
                variant={currentPage === index ? "default" : "outline"}
                onClick={() => setPage(index)}
                aria-current={currentPage === index ? "page" : undefined}
              >
                {index + 1}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              disabled={(currentPage + 1) * pageSize >= rows.length}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
