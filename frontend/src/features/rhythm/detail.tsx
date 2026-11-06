import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  History,
  Table2,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  STATUS_SENTENCES,
  orderDates,
  statusLabel,
  useData,
  type Customer,
  type Transaction,
} from "./data";
import { HtmlVisual, StatusBadge, ValueChip, rhythmStrip, returnWindowDial } from "./visuals";
import { useFormat, usePreferences } from "./preferences";
import { ActionComposer } from "./actions";

export function CustomerDetail({ customerId }: { customerId: string }) {
  const data = useData();
  const customers = data.customers as Customer[];
  const customer = customers.find((row) => row.customer_id === customerId);
  const { money, date } = useFormat();
  const { preferences } = usePreferences();
  const [historyView, setHistoryView] = useState<"timeline" | "table">("timeline");
  if (!customer)
    return (
      <div className="stitch-detail-empty">
        <h1>Customer not found</h1>
        <p>This customer is not in the active dataset.</p>
        <Button asChild className="mt-4">
          <Link to="/customers">Back to customers</Link>
        </Button>
      </div>
    );

  const c = customer;
  const customerIndex = customers.findIndex((row) => row.customer_id === customerId);
  const previous = customerIndex > 0 ? customers[customerIndex - 1] : null;
  const next =
    customerIndex >= 0 && customerIndex < customers.length - 1
      ? customers[customerIndex + 1]
      : null;
  const offerPct =
    c.offer_value != null && Number(c.avg_order_value) > 0
      ? (Number(c.offer_value) / Number(c.avg_order_value)) * 100
      : 0;
  const discountBlocked =
    c.offer_value != null && (!preferences.allowDiscounts || offerPct > preferences.maxDiscount);
  const orders = ((data.orders || []) as Transaction[]).filter(
    (order) => String(order.customer_id) === String(customerId),
  );
  const history = orders.slice(-20).reverse();
  const earlier = history.slice(4);
  const currentGap = Number(c.recency_days || 0);
  const usual = Number(c.usual_order_interval || 0);
  const reasons = c.why || [];
  const summaryMetrics = [
    {
      label: "Last order",
      value: c.last_order_date ? date(c.last_order_date) : null,
      note: c.recency_days == null ? null : `${c.recency_days}d ago`,
      icon: <CalendarDays />,
    },
    {
      label: "Current gap",
      value: c.recency_days == null ? null : `${c.recency_days} days`,
      note:
        usual > 0
          ? `${Math.max(0, currentGap - usual)}d past usual interval`
          : "Usual gap unavailable",
      icon: <Clock />,
    },
    {
      label: "Usual interval",
      value: usual > 0 ? `${usual.toFixed(1)} days` : null,
      note:
        c.usual_interval_low != null && c.usual_interval_high != null
          ? `Range ${c.usual_interval_low}–${c.usual_interval_high}d`
          : null,
      icon: <History />,
    },
    {
      label: "Average order",
      value: c.avg_order_value == null ? null : money(Number(c.avg_order_value)),
      note: "Average basket",
      icon: <Wallet />,
    },
    {
      label: "Orders / month",
      value: c.frequency == null ? null : `${Number(c.frequency).toFixed(1)} orders/mo`,
      note: "Historical frequency",
      icon: <CreditCard />,
    },
    {
      label: "Active tenure",
      value: c.active_months == null ? null : `${c.active_months} months`,
      note: c.first_order_date ? `Since ${date(c.first_order_date)}` : null,
      icon: <TrendingDown />,
    },
  ].filter((metric) => metric.value != null);

  return (
    <div className="stitch-customer-detail">
      <div className="stitch-detail-context">
        <Link to="/customers">
          <ArrowLeft size={14} /> Customers
        </Link>
        <span>/</span>
        <b>{c.customer_id}</b>
        <span>/</span>
        <StatusBadge status={c.status} size="sm" />
        <span className="stitch-detail-source">
          <i /> {data.summary.data_label || "Active dataset"}
        </span>
        <div className="stitch-detail-record-nav">
          {previous ? (
            <Link
              to="/customers/$customerId"
              params={{ customerId: previous.customer_id }}
              aria-label="Previous customer"
            >
              <ChevronLeft size={15} />
            </Link>
          ) : (
            <span>
              <ChevronLeft size={15} />
            </span>
          )}
          <small>
            {customerIndex + 1} / {customers.length}
          </small>
          {next ? (
            <Link
              to="/customers/$customerId"
              params={{ customerId: next.customer_id }}
              aria-label="Next customer"
            >
              <ChevronRight size={15} />
            </Link>
          ) : (
            <span>
              <ChevronRight size={15} />
            </span>
          )}
        </div>
      </div>

      <section className="stitch-detail-profile">
        <div className="stitch-detail-profile-head">
          <span
            className={`stitch-customer-avatar ${c.status === "At Risk" ? "is-risk" : c.status === "Loyal / High-Value" ? "is-loyal" : c.status === "Not enough history" ? "is-unscored" : ""}`}
          >
            <span aria-hidden="true">
              {c.status === "At Risk"
                ? "🙁"
                : c.status === "Loyal / High-Value"
                  ? "😊"
                  : c.status === "Not enough history"
                    ? "😐"
                    : "🙂"}
            </span>
          </span>
          <div className="stitch-detail-name">
            <h1>{c.customer_id}</h1>
            <div>
              <ValueChip value={c.value_tier} /> <StatusBadge status={c.status} size="sm" />{" "}
            </div>
            <p>{STATUS_SENTENCES[c.status]}</p>
          </div>
        </div>
        <div className="stitch-detail-summary-grid">
          {summaryMetrics.map((metric) => (
            <div className="stitch-detail-summary-metric" key={metric.label}>
              <span>
                {metric.icon}
                {metric.label}
              </span>
              <strong>{metric.value}</strong>
              {metric.note && <small>{metric.note}</small>}
            </div>
          ))}
        </div>
      </section>

      {c.is_lapsed && (
        <div className="stitch-detail-lapsed">
          No order for an extended period. Consider whether a win-back approach is appropriate.
        </div>
      )}

      <section className="stitch-detail-card stitch-recommended-action">
        <div className="stitch-action-banner">
          <span>
            <ArrowUpRight size={17} />
          </span>
          <div>
            <h2>Recommended action</h2>
            <p>
              {discountBlocked
                ? "The current offer is outside the saved business-rule limits."
                : "Recommendation from the existing retention analysis and business rules."}
            </p>
          </div>
          <b>{discountBlocked ? "Personal check-in" : c.action_type}</b>
        </div>
        <div className="stitch-action-detail-grid">
          {!discountBlocked && c.offer_value != null && (
            <div className="stitch-offer-summary">
              <span>Suggested offer value</span>
              <strong>{money(Number(c.offer_value))}</strong>
              <small>Offer value supplied by the active recommendation.</small>
            </div>
          )}
          <div className="stitch-suggestion-copy">
            <span>
              <FileText size={13} /> Suggested action
            </span>
            <p>
              {discountBlocked
                ? "Consider a personalised check-in without a discount; the suggested offer exceeds the current business-rule limit."
                : c.recommended_action.replaceAll("Rs", preferences.currency)}
            </p>
            <small>{c.short_reason || STATUS_SENTENCES[c.status]}</small>
          </div>
        </div>
        <ActionComposer customers={[c]} />
      </section>

      <section className="stitch-detail-visual-grid">
        <article className="stitch-detail-card stitch-rhythm-card">
          <div className="stitch-detail-card-heading">
            <div>
              <h2>
                <History size={16} /> Rhythm Strip
              </h2>
              <span>Observed cadence and expected return window</span>
            </div>
            <span className="stitch-rhythm-legend">
              <i /> Usual cadence <i className="late" /> Current delay
            </span>
          </div>
          <div
            className={`stitch-rhythm-visual rhythm-${c.status === "At Risk" ? "risk" : c.status === "Loyal / High-Value" ? "loyal" : "active"}`}
          >
            <HtmlVisual
              html={rhythmStrip(
                orderDates(c),
                c.usual_interval_low,
                c.usual_interval_high,
                c.last_order_date,
                data.summary.snapshot_date,
              )}
            />
          </div>
          <div className="stitch-rhythm-foot">
            <span>
              <Check size={13} /> Cadence is based on available purchase history.
            </span>
            <span>
              Snapshot{" "}
              {data.summary.snapshot_date ? date(data.summary.snapshot_date) : "unavailable"}
            </span>
          </div>
        </article>
        <article className="stitch-detail-card stitch-prediction-card">
          <div className="stitch-detail-card-heading">
            <div>
              <h2>Prediction</h2>
              <span>Chance of ordering within the next 30 days.</span>
            </div>
            {c.return_probability_pct != null && (
              <span
                className={`stitch-probability-chip${c.status === "At Risk" ? "" : " is-neutral"}`}
              >
                {c.status === "At Risk" ? "At risk" : "30-day estimate"}
              </span>
            )}
          </div>
          {c.return_probability_pct == null ? (
            <div className="stitch-detail-not-scored">
              <Clock size={22} />
              <b>Not scored</b>
              <span>{STATUS_SENTENCES[c.status]}</span>
            </div>
          ) : (
            <div className="stitch-detail-dial">
              <HtmlVisual html={returnWindowDial(c.return_probability_pct)} />
              <span>{c.return_probability_pct}%</span>
              <small>{statusLabel(c.status)}</small>
            </div>
          )}
          <p className="stitch-detail-note">
            This model estimate describes the next 30 days; it is not a guarantee.
          </p>
        </article>
      </section>

      <section className="stitch-detail-card stitch-root-signals">
        <div className="stitch-detail-card-heading">
          <div>
            <h2>
              <TrendingDown size={16} /> Root Signals &amp; Diagnostics
            </h2>
            <span>Signals available for this customer</span>
          </div>
          <span>{reasons.length} signals</span>
        </div>
        {reasons.length ? (
          <div className="stitch-root-signal-list">
            {reasons.map((reason, index) => (
              <details key={reason} open={index === 0}>
                <summary>
                  <span className={`stitch-signal-icon signal-${index % 3}`}>{index + 1}</span>
                  <b>{reason}</b>
                  <span className="stitch-signal-index">Signal {index + 1}</span>
                </summary>
                {index === 0 && <p>{c.short_reason || STATUS_SENTENCES[c.status]}</p>}
              </details>
            ))}
          </div>
        ) : (
          <p className="stitch-detail-muted">
            No specific behaviour drivers are available for this customer.
          </p>
        )}
      </section>

      <section className="stitch-detail-card stitch-history-panel">
        <div className="stitch-detail-card-heading">
          <div>
            <h2>
              <History size={16} /> Transaction History &amp; Order Cadence
            </h2>
            <span>{orders.length.toLocaleString()} transactions in the active dataset</span>
          </div>
          <div className="stitch-view-toggle" role="group" aria-label="Transaction history view">
            <button
              type="button"
              aria-pressed={historyView === "timeline"}
              onClick={() => setHistoryView("timeline")}
            >
              <History size={13} /> Timeline
            </button>
            <button
              type="button"
              aria-pressed={historyView === "table"}
              onClick={() => setHistoryView("table")}
            >
              <Table2 size={13} /> Table
            </button>
          </div>
        </div>
        <Link to="/transactions" className="stitch-history-data-link">
          Open dataset transactions <ArrowRight size={13} />
        </Link>
        {history.length ? (
          historyView === "table" ? (
            <div className="table-scroll">
              <table className="stitch-history-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Transaction date</th>
                    <th>Amount</th>
                    <th>Category</th>
                    <th>Payment method</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((order) => (
                    <tr key={order.order_id}>
                      <td>{order.order_id}</td>
                      <td>{date(order.order_date)}</td>
                      <td>{money(order.amount)}</td>
                      <td>{order.category || "Not provided"}</td>
                      <td>{order.payment_method || "Not provided"}</td>
                      <td>{order.order_status || "Not provided"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="stitch-history-timeline">
              {history.slice(0, 4).map((order, index) => (
                <article key={order.order_id}>
                  <span className="stitch-history-index">#{orders.length - index}</span>
                  <div>
                    <b>{order.order_id}</b>
                    <span>
                      {date(order.order_date)} · {order.order_status || "Status not provided"}
                    </span>
                    <small>
                      {order.category || order.payment_method || "Transaction details not provided"}
                    </small>
                  </div>
                  <strong>{money(order.amount)}</strong>
                </article>
              ))}
            </div>
          )
        ) : (
          <div className="stitch-detail-muted">
            Transaction history is not available in the active dataset.
          </div>
        )}
        {earlier.length > 0 && (
          <details className="stitch-earlier-orders">
            <summary>
              View {earlier.length} earlier available transactions <ChevronRight size={14} />
            </summary>
            <div className="table-scroll">
              <table className="stitch-history-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Transaction date</th>
                    <th>Amount</th>
                    <th>Category</th>
                    <th>Payment method</th>
                  </tr>
                </thead>
                <tbody>
                  {earlier.map((order) => (
                    <tr key={order.order_id}>
                      <td>{order.order_id}</td>
                      <td>{date(order.order_date)}</td>
                      <td>{money(order.amount)}</td>
                      <td>{order.category || "Not provided"}</td>
                      <td>{order.payment_method || "Not provided"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      <details className="stitch-detail-card stitch-supporting-measures">
        <summary>
          <span>
            <b>Supporting measures</b>
            <small>Additional available customer context</small>
          </span>
          <TrendingDown size={17} />
        </summary>
        <div className="metrics-grid">
          {[
            ["Frequency trend", c.frequency_trend_label],
            ["Spending trend", c.spending_trend_label],
            ["Active months", c.active_months],
            ["Favourite category", c.favourite_category],
            ["Favourite payment method", c.favourite_payment_method],
          ]
            .filter(([, value]) => value != null)
            .map(([label, value]) => (
              <div className="metric" key={String(label)}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
        </div>
      </details>
    </div>
  );
}
