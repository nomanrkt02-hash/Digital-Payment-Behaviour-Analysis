import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, ArrowUpDown, ArrowRight, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { likelihoodWord, useData, type Customer } from "./data";
import { StatusBadge, ValueChip } from "./visuals";
import { PageHeading } from "./shell";
import { usePreferences } from "./preferences";
import { ActionComposer } from "./actions";
export function CustomerAnalytics({
  initialStatus = "",
  initialValue = "",
  initialReason = "",
}: {
  initialStatus?: string;
  initialValue?: string;
  initialReason?: string;
}) {
  const SAMPLE_DATA = useData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState("");
  const [value, setValue] = useState(initialValue);
  const [sort, setSort] = useState("customer_id");
  const [asc, setAsc] = useState(true);
  const [page, setPage] = useState(0);
  const { preferences } = usePreferences();
  const navigate = useNavigate();
  const rows = SAMPLE_DATA.customers
    .filter(
      (c) =>
        c.customer_id.toLowerCase().includes(search.toLowerCase()) &&
        (!status || c.status === status) &&
        (!priority || c.priority === priority) &&
        (!value || c.value_tier === value) &&
        (!initialReason || matchesRiskReason(c, initialReason)),
    )
    .sort((a, b) => {
      const av =
        sort === "recency_days"
          ? a.recency_days
          : sort === "return_probability_pct"
            ? (a.return_probability_pct ?? -1)
            : sort === "avg_order_value"
              ? a.avg_order_value
              : a.customer_id;
      const bv =
        sort === "recency_days"
          ? b.recency_days
          : sort === "return_probability_pct"
            ? (b.return_probability_pct ?? -1)
            : sort === "avg_order_value"
              ? b.avg_order_value
              : b.customer_id;
      return (
        (typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv))) * (asc ? 1 : -1)
      );
    });
  const changeSort = (key: string) => {
    setAsc(sort === key ? !asc : true);
    setSort(key);
    setPage(0);
  };
  const resetPage = () => setPage(0);
  const size = preferences.rowsPerPage;
  const actualPage = Math.min(page, Math.max(0, Math.ceil(rows.length / size) - 1));
  const hasFilters = Boolean(search || status || priority || value || initialReason);
  return (
    <>
      <PageHeading
        title="Customers"
        subtitle="Search customers and review their risk and recommended action."
      >
        <span className="sample-tag">
          {SAMPLE_DATA.summary.total_customers.toLocaleString()} customers
        </span>
      </PageHeading>
      <div className="filter-chips">
        {[
          ["", "All customers"],
          ["At Risk", "At risk"],
          ["Active / Normal", "Active"],
          ["Loyal / High-Value", "Loyal"],
          ["Not enough history", "Not scored"],
        ].map(([v, label]) => (
          <Button
            key={v}
            variant={status === v ? "default" : "outline"}
            onClick={() => {
              setStatus(v ?? "");
              resetPage();
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="toolbar">
        <div className="search-box">
          <Search />
          <input
            aria-label="Search customer ID"
            placeholder="Search customer ID…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
          />
        </div>
        <select
          aria-label="Filter priority"
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value);
            resetPage();
          }}
        >
          <option value="">All priorities</option>
          {["High", "Medium", "Low"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Filter value"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            resetPage();
          }}
        >
          <option value="">All value tiers</option>
          {["High", "Medium", "Low"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Sort customers"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setAsc(true);
            resetPage();
          }}
        >
          <option value="customer_id">Sort: Customer ID</option>
          <option value="recency_days">Days since order</option>
          <option value="return_probability_pct">Return likelihood</option>
          <option value="avg_order_value">Average order value</option>
        </select>
      </div>
      {hasFilters && (
        <div className="filter-summary">
          <span>{rows.length.toLocaleString()} matching customers</span>
          <Button
            variant="ghost"
            onClick={() => {
              setStatus("");
              setPriority("");
              setValue("");
              setSearch("");
              if (initialReason) void navigate({ to: "/customers" });
              resetPage();
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      <section className="panel table-panel">
        <div className="table-scroll">
          <table className="customer-table">
            <thead>
              <tr>
                <th>
                  <Button variant="ghost" onClick={() => changeSort("customer_id")}>
                    Customer ID
                    <ArrowUpDown />
                  </Button>
                </th>
                <th>
                  <Button variant="ghost" onClick={() => changeSort("recency_days")}>
                    Current vs usual gap
                    <ArrowUpDown />
                  </Button>
                </th>
                <th>
                  <Button variant="ghost" onClick={() => changeSort("return_probability_pct")}>
                    Return likelihood
                    <ArrowUpDown />
                  </Button>
                </th>
                <th>Status</th>
                <th>Customer value</th>
                <th>Suggested action</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(actualPage * size, (actualPage + 1) * size).map((c) => (
                <tr
                  key={c.customer_id}
                  onClick={() =>
                    navigate({
                      to: "/customers/$customerId",
                      params: { customerId: c.customer_id },
                    })
                  }
                >
                  <td>
                    <Link
                      to="/customers/$customerId"
                      params={{ customerId: c.customer_id }}
                      className="font-semibold"
                    >
                      {c.customer_id}
                    </Link>
                  </td>
                  <td>
                    <strong>{c.recency_days}d</strong>
                    <span className="table-secondary"> since last order</span>
                    <span className="table-secondary">
                      Usual:{" "}
                      {c.usual_order_interval
                        ? `${Number(c.usual_order_interval).toFixed(0)}d`
                        : "not established"}
                    </span>
                  </td>
                  <td>
                    {c.return_probability_pct === null ? (
                      <span className="muted">Not scored</span>
                    ) : (
                      <div className="likelihood">
                        <span>
                          <b>{c.return_probability_pct}%</b> ·{" "}
                          {likelihoodWord(c.return_probability_pct)}
                        </span>
                        <div className="bar-track">
                          <svg
                            width="100%"
                            height="4"
                            viewBox="0 0 100 4"
                            preserveAspectRatio="none"
                          >
                            <rect
                              width={c.return_probability_pct}
                              height="4"
                              fill="var(--primary)"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>
                    <ValueChip value={c.value_tier} />
                  </td>
                  <td className="action-cell">{c.action_type}</td>
                  <td>
                    <Button variant="ghost" size="icon" asChild>
                      <Link
                        to="/customers/$customerId"
                        params={{ customerId: c.customer_id }}
                        aria-label={`View details for ${c.customer_id}`}
                      >
                        <ArrowRight />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty-state">
            <Filter size={30} />
            <h2>No customers match</h2>
            <p className="muted mt-2">Try a different search or remove a filter.</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => {
                setStatus("");
                setPriority("");
                setValue("");
                setSearch("");
                if (initialReason) void navigate({ to: "/customers" });
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
        <div className="table-bottom">
          <span className="muted">
            {rows.length
              ? `${actualPage * size + 1}–${Math.min((actualPage + 1) * size, rows.length)} of ${rows.length}`
              : "0"}{" "}
            customers
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              disabled={actualPage === 0}
              onClick={() => setPage(actualPage - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              disabled={(actualPage + 1) * size >= rows.length}
              onClick={() => setPage(actualPage + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

export function Outreach() {
  const data = useData();
  const [audience, setAudience] = useState("At Risk");
  const audiences = [
    { value: "", label: "All" },
    { value: "At Risk", label: "At Risk" },
    { value: "Active / Normal", label: "Active" },
    { value: "Loyal / High-Value", label: "Loyal" },
    { value: "Not enough history", label: "Not Scored" },
  ];
  const customers = data.customers.filter((customer) => !audience || customer.status === audience);
  return (
    <>
      <PageHeading
        title="Outreach"
        subtitle="Choose an audience, review a personalized preview, and prepare an action."
      />
      <section className="panel outreach-audience">
        <div className="outreach-audience-heading">
          <div>
            <div className="eyebrow">Audience</div>
            <h2>{customers.length.toLocaleString()} customers selected</h2>
          </div>
          <span className="sample-tag">{data.summary.data_label}</span>
        </div>
        <div className="filter-chips" role="group" aria-label="Choose outreach audience">
          {audiences.map((item) => (
            <Button
              key={item.value}
              variant={audience === item.value ? "default" : "outline"}
              onClick={() => setAudience(item.value)}
              aria-pressed={audience === item.value}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </section>
      <ActionComposer bulk customers={customers} />
    </>
  );
}

export function matchesRiskReason(customer: Customer, reason: string) {
  switch (reason) {
    case "Order gap much longer than usual":
      return (
        customer.status === "At Risk" &&
        (customer.overdue_ratio != null
          ? customer.overdue_ratio >= 1.5
          : customer.usual_order_interval > 0 &&
            customer.recency_days / customer.usual_order_interval >= 1.5)
      );
    case "Ordering frequency has decreased":
      return customer.status === "At Risk" && customer.frequency_trend_label === "Decreasing";
    case "Spending has decreased":
      return customer.status === "At Risk" && customer.spending_trend_label === "Decreasing";
    case "Inactive for a very long time (lapsed)":
      return customer.status === "At Risk" && customer.is_lapsed;
    case "Order value is shrinking":
      return (
        customer.status === "At Risk" &&
        (customer.recent_order_count_90 != null && customer.recent_aov_ratio != null
          ? customer.recent_order_count_90 > 0 && customer.recent_aov_ratio < 0.8
          : customer.short_reason.toLowerCase().includes("order value"))
      );
    default:
      return customer.status === "At Risk";
  }
}
