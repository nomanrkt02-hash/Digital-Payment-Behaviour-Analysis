import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CircleHelp,
  RotateCcw,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { statusLabel, useData, type Customer } from "./data";
import { matchesRiskReason } from "./customers";
import { StatusBadge } from "./visuals";

type Signal = {
  reason: string;
  customers: number;
  share?: number | null;
  share_of_at_risk?: number | null;
};
type Action = { action_type: string; customers: number; high_priority?: number };
const count = (value: unknown) => Number(value || 0).toLocaleString();
const approvedReasons: Record<string, string> = {
  "Order gap much longer than usual": "Order gap much longer than usual",
  "Inactive for a very long time (lapsed)": "Inactive for a very long time",
  "Inactive for a very long time": "Inactive for a very long time",
  "Spending has decreased": "Spending has decreased",
  "Ordering frequency has decreased": "Ordering frequency has decreased",
};
const displayAction = (value: string) =>
  value.replace(/\bVIP benefits\b/gi, "Customer recognition")
    .replace(/\bVIP\b/gi, "valued customer")
    .replace(/\bLoyalty points\b/gi, "Customer reward")
    .replace(/\bLapsed\b/gi, "Inactive");

export function StitchInsights() {
  const data = useData();
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const signals = [...(data.analytics.reasons || [])]
    .filter((signal) => Boolean(approvedReasons[signal.reason]))
    .sort((a, b) => Number(b.customers) - Number(a.customers)) as Signal[];
  const reasonLabel = (reason: string) => approvedReasons[reason] || reason;
  const actions = [...(data.analytics.actions || [])].sort(
    (a, b) => Number(b.customers) - Number(a.customers),
  ) as Action[];
  const customers = data.customers as Customer[];
  const filtered = useMemo(
    () =>
      customers.filter(
        (customer) =>
          (!status || customer.status === status) &&
          (!priority || customer.priority === priority) &&
          (!selectedReason || matchesRiskReason(customer, selectedReason)),
      ),
    [customers, priority, selectedReason, status],
  );
  const selectedMatches = selectedReason
    ? filtered
    : filtered.filter((customer) => customer.status === "At Risk");
  const maxRecency = Math.max(
    1,
    ...selectedMatches.map((customer) => Number(customer.recency_days || 0)),
  );
  const topSignal = signals[0];
  const active = Number(data.summary.active || 0);
  const loyal = Number(data.summary.loyal || 0);
  const notScored = Number(data.summary.not_enough_history || 0);
  const highRisk = customers.filter(
    (c) => c.status === "At Risk" && c.value_tier === "High",
  ).length;
  const mediumRisk = customers.filter(
    (c) => c.status === "At Risk" && c.value_tier === "Medium",
  ).length;
  const lowRisk = customers.filter((c) => c.status === "At Risk" && c.value_tier === "Low").length;

  const reset = () => {
    setStatus("");
    setPriority("");
    setSelectedReason("");
  };
  return (
    <div className="stitch-insights">
      <header className="stitch-insights-header">
        <div>
          <span className="stitch-insights-kicker">Customer retention analytics</span>
          <h1>Retention Insights</h1>
          <p>
            Customer behaviour patterns affecting 30-day return, based on the active analysis.
          </p>
        </div>
        <div className="stitch-insight-filters">
          <label>
            <SlidersHorizontal size={14} />
            <span className="sr-only">Filter status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="At Risk">At risk</option>
              <option value="Active / Normal">Active</option>
              <option value="Loyal / High-Value">Loyal</option>
              <option value="Not enough history">Not scored</option>
            </select>
          </label>
          <select
            aria-label="Filter priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="">All priorities</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
          <Button variant="outline" onClick={reset}>
            <RotateCcw size={13} /> Reset
          </Button>
        </div>
      </header>

      <nav className="stitch-insight-phases" aria-label="Insight steps">
        {[
          ["diagnostics", "What’s happening", "Order patterns & return"],
          [
            "drivers",
            "Why it happens",
            "Approved drivers",
            `${Math.min(signals.length, 4)} of 4 drivers`,
          ],
          ["affected", "Who is affected", "Priority customer distribution"],
          ["recommendations", "What to do", "Recommended actions"],
        ].map(([id, phase, title, note], index) => (
          <a href={`#insight-${id}`} key={id} className={index === 0 ? "selected" : ""}>
            <b>{phase}</b>
            <strong>{title}</strong>
            <span>{note}</span>
          </a>
        ))}
      </nav>

      <section className="stitch-insight-summary">
        <div className="stitch-insight-risk-lead">
          <span>
            <Activity size={20} />
          </span>
          <div>
            <strong>
              {count(data.summary.at_risk)} of {count(data.summary.total_customers)} customers show
              retention risk
            </strong>
            <p>
              Customers outside their expected purchasing cadence, according to the current
              analysis.
            </p>
          </div>
        </div>
        <div className="stitch-insight-summary-metrics">
          <div className="risk">
            <small>At risk</small>
            <b>{count(data.summary.at_risk)}</b>
          </div>
          <div>
            <small>Active</small>
            <b>{count(active)}</b>
          </div>
          <div>
            <small>Loyal</small>
            <b>{count(loyal)}</b>
          </div>
          <div>
            <small>Not scored</small>
            <b>{count(notScored)}</b>
          </div>
          <div>
            <small>Avg 30d return</small>
            <b>
              {data.summary.avg_return_probability == null
                ? "—"
                : `${Math.round(Number(data.summary.avg_return_probability) * 100)}%`}
            </b>
          </div>
        </div>
      </section>

      <section className="stitch-insight-section" id="insight-diagnostics">
        <div className="stitch-insight-section-heading">
          <div>
            <h2>Behaviour patterns</h2>
            <p>Select a driver to filter affected customers and the behaviour map.</p>
          </div>
          {selectedReason && (
            <span>
              Selected: <b>{reasonLabel(selectedReason)}</b>
            </span>
          )}
        </div>
        <div className="stitch-diagnostic-grid">
          {signals.slice(0, 4).map((signal, index) => {
            const share = Number(
              signal.share_of_at_risk ??
                signal.share ??
                (Number(data.summary.at_risk)
                  ? (Number(signal.customers) / Number(data.summary.at_risk)) * 100
                  : 0),
            );
            return (
              <button
                key={signal.reason}
                className={`stitch-diagnostic-card ${selectedReason === signal.reason ? "selected" : ""}`}
                type="button"
                aria-pressed={selectedReason === signal.reason}
                onClick={() =>
                  setSelectedReason(selectedReason === signal.reason ? "" : signal.reason)
                }
              >
                <div className="stitch-diagnostic-card-top">
                  <span className={`stitch-diagnostic-icon diagnostic-${index}`}>
                    <Activity size={16} />
                  </span>
                  <span className="stitch-signal-status">
                    {status ? statusLabel(status) : "At risk"}
                  </span>
                </div>
                <h3>{reasonLabel(signal.reason)}</h3>
                <strong>{count(signal.customers)}</strong>
                <p>{share.toFixed(1)}% of at-risk customers in the analysis.</p>
                <span className="stitch-diagnostic-footer">
                  Filter map <ArrowRight size={13} />
                </span>
              </button>
            );
          })}
          {!signals.length && (
            <div className="stitch-insight-empty">
              Risk-driver details are not available for this dataset.
            </div>
          )}
        </div>
      </section>

      <section className="stitch-insight-map-layout">
        <article className="stitch-insight-panel stitch-rhythm-map" id="insight-affected">
          <div className="stitch-insight-panel-head">
            <div>
              <h2>
                <Activity size={16} /> Behaviour Map
              </h2>
              <p>
                Each point uses customer recency and 30-day return likelihood from the active data.
              </p>
            </div>
            <div className="stitch-map-legend">
              <span>
                <i className="risk" />
                At risk
              </span>
              <span>
                <i className="active" />
                Active
              </span>
              <span>
                <i className="loyal" />
                Loyal
              </span>
              <span>
                <i className="not-scored" />
                Not scored
              </span>
            </div>
          </div>
          {selectedMatches.length ? (
            <>
              <div
                className="stitch-scatter-chart"
                role="img"
                aria-label="Customer recency versus 30-day return likelihood"
              >
                <div className="stitch-scatter-y-label">30-day return likelihood</div>
                <div className="stitch-scatter-y-axis">
                  <span>100%</span>
                  <span>75%</span>
                  <span>50%</span>
                  <span>25%</span>
                  <span>0%</span>
                </div>
                <div className="stitch-scatter-grid">
                  {[0, 1, 2, 3, 4].map((tick) => (
                    <i key={tick} />
                  ))}
                  {selectedMatches.map((customer) => {
                    const recency = Number(customer.recency_days || 0);
                    const probability = customer.return_probability_pct;
                    const tone =
                      customer.status === "At Risk"
                        ? "risk"
                        : customer.status === "Loyal / High-Value"
                          ? "loyal"
                          : customer.status === "Not enough history"
                            ? "not-scored"
                            : "active";
                    return (
                      <Link
                        key={customer.customer_id}
                        to="/customers/$customerId"
                        params={{ customerId: customer.customer_id }}
                        className={`stitch-scatter-point ${tone}`}
                        style={{
                          left: `${Math.min(98, Math.max(1, (recency / maxRecency) * 100))}%`,
                          bottom: `${Math.min(97, Math.max(3, probability == null ? 4 : probability))}%`,
                        }}
                        title={`${customer.customer_id} · ${recency} days since order · ${probability == null ? "Not scored" : `${probability}% return estimate`}`}
                        aria-label={`Open ${customer.customer_id}`}
                      />
                    );
                  })}
                </div>
                <div className="stitch-scatter-x-axis">
                  <span>0 days</span>
                  <span>{Math.round(maxRecency / 3)} days</span>
                  <span>{Math.round((maxRecency * 2) / 3)} days</span>
                  <span>{maxRecency} days since last order</span>
                </div>
              </div>
              <div className="stitch-rhythm-map-foot">
                <span>Showing {count(selectedMatches.length)} customer profiles</span>
                <Link
                  to="/customers"
                  search={{
                    ...(status ? { status } : {}),
                    ...(selectedReason ? { reason: selectedReason } : {}),
                  }}
                >
                  View matching customers <ArrowRight size={13} />
                </Link>
              </div>
            </>
          ) : (
            <div className="stitch-insight-empty">No customers match the selected filters.</div>
          )}
        </article>
        <article className="stitch-insight-panel stitch-matching-insight">
          <div className="stitch-insight-panel-head">
            <div>
              <span className="stitch-insight-overline">Contextual population</span>
              <h2>Customers Matching Insight</h2>
            </div>
            <span className="stitch-selected-count">{count(selectedMatches.length)} selected</span>
          </div>
          {selectedReason && (
            <div className="stitch-selected-reason">
              <b>{reasonLabel(selectedReason)}</b>
                <span>Selected behaviour pattern</span>
            </div>
          )}
          <h3>Priority profiles</h3>
          {selectedMatches.slice(0, 4).map((customer) => (
            <Link
              key={customer.customer_id}
              to="/customers/$customerId"
              params={{ customerId: customer.customer_id }}
              className="stitch-priority-profile"
            >
              <span className="stitch-profile-mark">
                {customer.status === "At Risk" ? "!" : "•"}
              </span>
              <div>
                <b>{customer.customer_id}</b>
                <small>
                  {customer.value_tier ? `${customer.value_tier} Value` : "Value tier unavailable"} · gap{" "}
                  {count(customer.recency_days)}d
                  {customer.usual_order_interval
                    ? ` (usual ${Number(customer.usual_order_interval).toFixed(1)}d)`
                    : ""}
                </small>
              </div>
              <StatusBadge status={customer.status} />
              <strong>
                {customer.return_probability_pct == null
                  ? "Not scored"
                  : `${customer.return_probability_pct}% return`}
              </strong>
            </Link>
          ))}
          {!selectedMatches.length && (
            <p className="stitch-insight-empty">No matching customer profiles.</p>
          )}
          <Link
            className="stitch-insight-primary-link"
            to="/customers"
            search={{
              ...(status ? { status } : {}),
              ...(selectedReason ? { reason: selectedReason } : {}),
            }}
          >
            View affected customers <ArrowRight size={14} />
          </Link>
          <Link className="stitch-insight-secondary-link" to="/outreach">
            Prepare message in Outreach <ArrowUpRight size={13} />
          </Link>
        </article>
      </section>

      <section className="stitch-insight-lower-grid">
        <article className="stitch-insight-panel" id="insight-drivers">
          <div className="stitch-insight-panel-head">
            <h2>
              <CircleHelp size={15} /> Why: Behavioral Drivers
            </h2>
          </div>
          <p>Leading root causes across at-risk customer profiles.</p>
          {signals.slice(0, 4).map((signal, index) => (
            <Link
              key={signal.reason}
              to="/customers"
              search={{ status: "At Risk", reason: signal.reason }}
              className="stitch-reason-meter"
            >
              <span>{reasonLabel(signal.reason)}</span>
              <b>{count(signal.customers)}</b>
              <small>{Number(signal.share_of_at_risk ?? signal.share ?? 0).toFixed(1)}%</small>
              <i>
                <em
                  className={`driver-${index}`}
                  style={{
                    width: `${Math.max(1, Math.min(100, Number(signal.share_of_at_risk ?? signal.share ?? 0)))}%`,
                  }}
                />
              </i>
            </Link>
          ))}
        </article>
        <article className="stitch-insight-panel">
          <div className="stitch-insight-panel-head">
            <h2>
              <Users size={15} /> Who: Priority Breakdown
            </h2>
          </div>
          <p>At-risk counts by existing customer value tier.</p>
          {[
            ["High value at risk", highRisk],
            ["Medium value at risk", mediumRisk],
            ["Low value at risk", lowRisk],
          ].map(([label, value]) => (
            <Link
              key={label}
              to="/customers"
              search={{ status: "At Risk", value: String(label).split(" ")[0] || "" }}
              className="stitch-priority-breakdown"
            >
              <span>{label}</span>
              <b>{count(value)} customers</b>
            </Link>
          ))}
        </article>
        <article className="stitch-insight-panel" id="insight-recommendations">
          <div className="stitch-insight-panel-head">
            <h2>
              <Activity size={15} /> What to do: Recommended Actions
            </h2>
          </div>
          <p>Action groups supplied by the current analysis.</p>
          {actions.slice(0, 4).map((action) => (
            <div className="stitch-recommended-group" key={action.action_type}>
              <b>{displayAction(action.action_type)}</b>
              <span>{count(action.customers)} customers</span>
              {Number(action.high_priority || 0) > 0 && (
                <small>{count(action.high_priority)} high priority</small>
              )}
              <Link to="/customers" search={{ status: "At Risk" }}>
                View audience <ArrowRight size={12} />
              </Link>
            </div>
          ))}
          <Link className="stitch-insight-secondary-link" to="/outreach">
            Open Outreach <ArrowUpRight size={13} />
          </Link>
        </article>
      </section>
      {!topSignal && (
        <p className="stitch-insight-source-note">
          This dataset does not provide behavioral driver details.
        </p>
      )}
    </div>
  );
}
