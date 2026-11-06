import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutGrid,
  List,
  Search,
  Send,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { likelihoodWord, useData, type Customer } from "./data";
import { StatusBadge } from "./visuals";
import { matchesRiskReason } from "./customers";
import { usePreferences } from "./preferences";

type Preset =
  "all" | "needs-action" | "high-value-risk" | "lapsed" | "loyal" | "not-scored" | "custom";

export function StitchCustomers({
  initialStatus = "",
  initialValue = "",
  initialReason = "",
}: {
  initialStatus?: string;
  initialValue?: string;
  initialReason?: string;
}) {
  const data = useData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState("");
  const [value, setValue] = useState(initialValue);
  const [reason, setReason] = useState(initialReason);
  const [sort, setSort] = useState("customer_id");
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"table" | "cards">("table");
  const [preset, setPreset] = useState<Preset>(
    initialStatus || initialValue || initialReason ? "custom" : "all",
  );
  const { preferences } = usePreferences();
  const customers = data.customers;
  const presets: { id: Preset; label: string; count: number }[] = [
    { id: "all", label: "All", count: customers.length },
    {
      id: "needs-action",
      label: "Needs action today",
      count: customers.filter((c) => c.status === "At Risk" && c.priority === "High").length,
    },
    {
      id: "high-value-risk",
      label: "High value at risk",
      count: customers.filter((c) => c.status === "At Risk" && c.value_tier === "High").length,
    },
    {
      id: "lapsed",
      label: "Long inactive",
      count: customers.filter((c) => c.is_lapsed).length,
    },
    {
      id: "loyal",
      label: "Loyal",
      count: customers.filter((c) => c.status === "Loyal / High-Value").length,
    },
    {
      id: "not-scored",
      label: "Not scored",
      count: customers.filter((c) => c.status === "Not enough history").length,
    },
  ];
  const filtered = customers.filter((c) => {
    if (!c.customer_id.toLowerCase().includes(search.toLowerCase())) return false;
    if (status && c.status !== status) return false;
    if (priority && c.priority !== priority) return false;
    if (value && c.value_tier !== value) return false;
    if (reason && !matchesRiskReason(c, reason)) return false;
    if (preset === "needs-action" && !(c.status === "At Risk" && c.priority === "High"))
      return false;
    if (preset === "high-value-risk" && !(c.status === "At Risk" && c.value_tier === "High"))
      return false;
    if (preset === "lapsed" && !c.is_lapsed) return false;
    if (preset === "loyal" && c.status !== "Loyal / High-Value") return false;
    if (preset === "not-scored" && c.status !== "Not enough history") return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    const av =
      sort === "recency_days"
        ? a.recency_days
        : sort === "return_probability_pct"
          ? (a.return_probability_pct ?? -1)
          : a.customer_id;
    const bv =
      sort === "recency_days"
        ? b.recency_days
        : sort === "return_probability_pct"
          ? (b.return_probability_pct ?? -1)
          : b.customer_id;
    return (
      (typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv))) * (ascending ? 1 : -1)
    );
  });
  const pageSize = preferences.rowsPerPage;
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const visiblePageCount = Math.min(4, pageCount);
  const pageStart = Math.min(Math.max(0, currentPage - 1), pageCount - visiblePageCount);
  const hasFilters = Boolean(
    search || status || priority || value || reason || (preset !== "all" && preset !== "custom"),
  );

  const selectPreset = (id: Preset) => {
    setPreset(id);
    setStatus("");
    setPriority("");
    setValue("");
    setReason("");
    setPage(0);
  };
  const changeSort = (key: string) => {
    setAscending(sort === key ? !ascending : true);
    setSort(key);
    setPage(0);
  };
  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    setValue("");
    setReason("");
    setPreset("all");
    setPage(0);
  };

  return (
    <div className="stitch-customers">
      <header className="stitch-customers-header">
        <div>
          <h1>Customers</h1>
          <p>Review customer cadence, return likelihood, and recommended next actions.</p>
        </div>
        <div className="stitch-view-toggle" role="group" aria-label="Customer view">
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
            <List size={15} /> Table
          </button>
          <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")}>
            <LayoutGrid size={15} /> Cards
          </button>
        </div>
      </header>

      <div className="stitch-customer-presets" role="group" aria-label="Customer segments">
        {presets.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={preset === item.id}
            onClick={() => selectPreset(item.id)}
          >
            <span>{item.label}</span>
            <b>{item.count.toLocaleString()}</b>
          </button>
        ))}
      </div>

      <section className="stitch-customer-controls" aria-label="Search and filter customers">
        <div className="stitch-customer-search">
          <Search size={16} />
          <input
            aria-label="Search customer ID"
            placeholder="Search customer IDs…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </div>
        <select
          aria-label="Filter status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPreset("custom");
            setPage(0);
          }}
        >
          <option value="">All statuses</option>
          <option value="At Risk">At risk</option>
          <option value="Active / Normal">Active</option>
          <option value="Loyal / High-Value">Loyal</option>
          <option value="Not enough history">Not scored</option>
        </select>
        <select
          aria-label="Filter priority"
          value={priority}
          onChange={(event) => {
            setPriority(event.target.value);
            setPreset("custom");
            setPage(0);
          }}
        >
          <option value="">All priorities</option>
          {["High", "Medium", "Low"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          aria-label="Filter value tier"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setPreset("custom");
            setPage(0);
          }}
        >
          <option value="">All value tiers</option>
          {["High", "Medium", "Low"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          aria-label="Sort customers"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setAscending(true);
            setPage(0);
          }}
        >
          <option value="customer_id">Sort: Customer ID</option>
          <option value="recency_days">Days since order</option>
          <option value="return_probability_pct">Return likelihood</option>
        </select>
      </section>
      {hasFilters && (
        <div className="stitch-customer-filter-state">
          <span>{sorted.length.toLocaleString()} matching customers</span>
          <button type="button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}

      <section className="stitch-customer-table-card">
        <div className="stitch-customer-table-head">
          <div>
            <h2>Customers</h2>
            <span>{sorted.length.toLocaleString()} matching profiles</span>
          </div>
          <Link
            to="/outreach"
            search={{
              fromCustomers: true,
              q: search,
              status:
                status ||
                (preset === "needs-action" || preset === "high-value-risk"
                  ? "At Risk"
                  : preset === "loyal"
                    ? "Loyal / High-Value"
                    : preset === "not-scored"
                      ? "Not enough history"
                      : ""),
              priority: priority || (preset === "needs-action" ? "High" : ""),
              valueTier: value || (preset === "high-value-risk" ? "High" : ""),
              reason,
              segment: preset === "lapsed" ? "lapsed" : "",
            }}
            className="stitch-bulk-action"
          >
            <Send size={14} /> Prepare audience · {sorted.length.toLocaleString()} customers
          </Link>
        </div>
        {view === "table" ? (
          <div className="table-scroll">
            <table className="stitch-customer-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" onClick={() => changeSort("customer_id")}>
                      Customer <ArrowUpDown size={13} />
                    </button>
                  </th>
                  <th>Status</th>
                  <th>
                    <button type="button" onClick={() => changeSort("recency_days")}>
                      Usual interval <ArrowUpDown size={13} />
                    </button>
                  </th>
                  <th>Activity</th>
                  <th>
                    <button type="button" onClick={() => changeSort("return_probability_pct")}>
                      30D Return <ArrowUpDown size={13} />
                    </button>
                  </th>
                  <th>Next Action</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((customer) => (
                  <CustomerTableRow key={customer.customer_id} customer={customer} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="stitch-customer-card-grid">
            {pageRows.map((customer) => (
              <CustomerCard key={customer.customer_id} customer={customer} />
            ))}
          </div>
        )}
        {!sorted.length && (
          <div className="stitch-customers-empty">
            <Users size={28} />
            <h2>No customers match this filter</h2>
            <p>Change the search or customer filters to review another group.</p>
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
        <div className="stitch-customer-pagination">
          <span>
            {sorted.length
              ? `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, sorted.length)} of ${sorted.length}`
              : "0"}{" "}
            customers
          </span>
          <div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft />
            </Button>
            {Array.from({ length: visiblePageCount }, (_, index) => {
              const pageIndex = pageStart + index;
              return (
                <Button
                  key={pageIndex}
                  variant={currentPage === pageIndex ? "default" : "outline"}
                  onClick={() => setPage(pageIndex)}
                  aria-current={currentPage === pageIndex ? "page" : undefined}
                >
                  {pageIndex + 1}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              disabled={(currentPage + 1) * pageSize >= sorted.length}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CustomerTableRow({ customer }: { customer: Customer }) {
  return (
    <tr>
      <td>
        <Link
          className="stitch-customer-identity"
          to="/customers/$customerId"
          params={{ customerId: customer.customer_id }}
        >
          <b>{customer.customer_id}</b>
          <small>{customer.value_tier} value</small>
        </Link>
      </td>
      <td>
        <div className="stitch-status-priority">
          <StatusBadge status={customer.status} />
          <small>Priority · {customer.priority || "Not available"}</small>
        </div>
      </td>
      <td>
        <div className="stitch-customer-rhythm">
          <span>
            {customer.usual_order_interval > 0
              ? `Usually every ${Number(customer.usual_order_interval).toFixed(0)}d`
              : "Cadence establishing"}
          </span>
          <small>{customer.recency_days}d since last order</small>
        </div>
      </td>
      <td>
        <div className="stitch-customer-activity">
          <span>{customer.last_order_date || "Date unavailable"}</span>
          <small>{customer.frequency_trend_label || "Activity trend unavailable"}</small>
        </div>
      </td>
      <td>
        {customer.return_probability_pct == null ? (
          <span className="stitch-unscored">Not scored</span>
        ) : (
          <div className="stitch-customer-likelihood">
            <b>{customer.return_probability_pct}%</b>
            <span>{likelihoodWord(customer.return_probability_pct)}</span>
            <i>
              <em style={{ width: `${customer.return_probability_pct}%` }} />
            </i>
          </div>
        )}
      </td>
      <td>
        <span className="stitch-next-action">{customerActionLabel(customer)}</span>
        <small className="stitch-action-detail">{customerActionDetail(customer)}</small>
      </td>
      <td>
        <div className="stitch-row-actions">
          <Link
            to="/customers/$customerId"
            params={{ customerId: customer.customer_id }}
            aria-label={`Quick view ${customer.customer_id}`}
            title="Quick view"
          >
            <Eye size={15} />
          </Link>
          <Link
            to="/outreach"
            search={{ customerId: customer.customer_id }}
            aria-label={`Prepare an action for ${customer.customer_id}`}
            title="Prepare an action"
          >
            <Send size={14} />
          </Link>
        </div>
      </td>
    </tr>
  );
}

function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <article className="stitch-customer-card">
      <div className="stitch-customer-card-head">
        <Link to="/customers/$customerId" params={{ customerId: customer.customer_id }}>
          {customer.customer_id}
        </Link>
        <StatusBadge status={customer.status} />
      </div>
      <div className="stitch-card-customer-meta">
        <span>{customer.value_tier} value</span>
        <span>Priority · {customer.priority || "Not available"}</span>
      </div>
      <p>{customerCopy(customer.short_reason || "No behavioural summary available.")}</p>
      <div className="stitch-card-activity">
        <span>{customer.last_order_date || "Date unavailable"}</span>
        <small>{customer.frequency_trend_label || "Activity trend unavailable"}</small>
      </div>
      <div className="stitch-customer-card-metrics">
        <span>
          Usual interval
          <b>
            {customer.usual_order_interval > 0
              ? `Every ${Number(customer.usual_order_interval).toFixed(0)}d`
              : "Not established"}
          </b>
          <small>{customer.recency_days}d since last order</small>
        </span>
        <span>
          30D Return
          <b>
            {customer.return_probability_pct == null
              ? "Not scored"
              : `${customer.return_probability_pct}%`}
          </b>
        </span>
      </div>
      <div className="stitch-card-next-action">
        <span>{customerActionLabel(customer)}</span>
        <small>{customerActionDetail(customer)}</small>
      </div>
      <div className="stitch-customer-card-actions">
        <Link to="/customers/$customerId" params={{ customerId: customer.customer_id }}>
          Open <Eye size={13} />
        </Link>
        <Link to="/outreach" search={{ customerId: customer.customer_id }}>
          Prepare action <Send size={13} />
        </Link>
      </div>
    </article>
  );
}

function customerCopy(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\bVIP benefits\b/gi, "loyalty recognition")
    .replace(/\bVIP\b/gi, "loyal")
    .replace(/\brhythm\b/gi, "order cadence");
}

function customerActionLabel(customer: Customer) {
  return customer.action_type === "VIP benefits"
    ? "Loyalty recognition"
    : customerCopy(customer.action_type || "Recommendation unavailable");
}

function customerActionDetail(customer: Customer) {
  if (customer.action_type === "VIP benefits") {
    return "Recognize this customer's consistent activity and loyalty.";
  }
  return customerCopy(customer.recommended_action || "Action details unavailable.");
}
