import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  CircleHelp,
  CreditCard,
  ShieldAlert,
  TrendingDown,
  Users,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useData } from "./data";
import { ReturnTrend } from "./charts";
import { StatusBadge } from "./components";

type AttentionRow = {
  customer_id: string;
  status: string;
  short_reason: string;
  priority: string;
  value_tier?: string;
  return_probability_pct?: number | null;
  recency_days?: number;
  usual_order_interval?: number | null;
  recommended_action?: string;
};
type ActivityPoint = {
  month: string;
  orders?: number;
  active_customers?: number;
  revenue?: number;
};
const EMPTY_ACTIVITY: ActivityPoint[] = [];

const count = (value: unknown) => Number(value || 0).toLocaleString();
const percent = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);
const monthLabel = (month: string) =>
  new Date(`${month}-01`).toLocaleDateString("en", { month: "short", timeZone: "UTC" });

export function Overview() {
  const data = useData();
  const [period, setPeriod] = useState<"6M" | "12M" | "All">("12M");
  const total = Number(data.summary.total_customers || 0);
  const atRisk = Number(data.summary.at_risk || 0);
  const distribution = data.analytics.status_distribution || [];
  const trend = data.analytics.return_trend || [];
  const activity = (data.analytics.monthly_activity || EMPTY_ACTIVITY) as ActivityPoint[];
  const changes = data.analytics.behaviour_changes;
  const reasons = [...(data.analytics.reasons || [])].sort(
    (a, b) => Number(b.customers) - Number(a.customers),
  );
  const approvedDriverLabels: Record<string, string> = {
    "Order gap much longer than usual": "Order gap much longer than usual",
    "Inactive for a very long time (lapsed)": "Inactive for a very long time",
    "Spending has decreased": "Spending has decreased",
    "Ordering frequency has decreased": "Ordering frequency has decreased",
  };
  const approvedReasons = reasons
    .filter((reason) => reason.reason in approvedDriverLabels)
    .sort(
      (a, b) =>
        [
          "Order gap much longer than usual",
          "Inactive for a very long time (lapsed)",
          "Spending has decreased",
          "Ordering frequency has decreased",
        ].indexOf(a.reason) -
        [
          "Order gap much longer than usual",
          "Inactive for a very long time (lapsed)",
          "Spending has decreased",
          "Ordering frequency has decreased",
        ].indexOf(b.reason),
    );
  const actions = [...(data.analytics.actions || [])].sort(
    (a, b) => Number(b.customers) - Number(a.customers),
  );
  const attention = ((data.analytics.attention || []) as AttentionRow[]).slice(0, 5);
  const active = Number(data.summary.active || 0);
  const loyal = Number(data.summary.loyal || 0);
  const unscored = Number(data.summary.not_enough_history || 0);
  const latestObserved = trend.at(-1);
  const latestActivity = activity.at(-1);
  const selectedActivity = useMemo(() => {
    const length = period === "6M" ? 6 : period === "12M" ? 12 : activity.length;
    return activity.slice(-length).map((row) => ({ ...row, label: monthLabel(row.month) }));
  }, [activity, period]);
  const riskTotalForChanges =
    Number(changes?.frequency?.Decreasing || 0) +
    Number(changes?.frequency?.Stable || 0) +
    Number(changes?.frequency?.Increasing || 0);

  return (
    <div className="stitch-overview">
      <header className="stitch-overview-header">
        <div>
          <h1>Retention Overview</h1>
          <p>
            {data.summary.data_label || "Active dataset"}
            {data.summary.date_min && data.summary.date_max
              ? ` · ${data.summary.date_min} to ${data.summary.date_max}`
              : ""}
          </p>
          <span>Predicted 30-day return probabilities across customers</span>
        </div>
        <div className="stitch-period-control" aria-label="Monthly activity period">
          {(["6M", "12M", "All"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </header>

      <Link to="/customers" search={{ status: "At Risk" }} className="stitch-risk-banner">
        <div>
          <ShieldAlert size={19} />
          <strong>{count(atRisk)} customers may stop ordering</strong>
          <span>High priority · Review the customers flagged by this analysis.</span>
        </div>
        <span className="stitch-banner-action">
          Review them <ArrowRight size={16} />
        </span>
      </Link>

      <nav className="stitch-story-nav" aria-label="Overview sections">
        {[
          ["how-many", "How many"],
          ["changing", "What’s changing"],
          ["affected", "Who’s affected"],
          ["actions", "What to do"],
        ].map(([id, label]) => (
          <a key={id} href={`#overview-${id}`}>
            {label}
          </a>
        ))}
      </nav>

      <section className="stitch-overview-section" id="overview-how-many">
        <SectionHeading
          title="Retention at a glance"
          note="Customer status and 30-day return outlook"
        />
        <div className="stitch-magnitude-grid">
          <MetricCard
            icon={<Users />}
            label="Customers"
            value={count(total)}
            note="Customers in dataset"
          />
          <MetricCard
            icon={<TrendingDown />}
            label="At risk"
            value={count(atRisk)}
            note={`${percent(atRisk, total)}% · Slipping ordering rhythm`}
            tone="risk"
          />
          <MetricCard
            icon={<Activity />}
            label="Predicted to return · 30 d"
            value={
              data.summary.avg_return_probability == null
                ? "—"
                : `${Math.round(Number(data.summary.avg_return_probability) * 100)}%`
            }
            note="Average model estimate"
          />
          <MetricCard
            icon={<CreditCard />}
            label="Orders"
            value={count(data.summary.total_orders)}
            note={
              data.summary.date_min && data.summary.date_max
                ? `${data.summary.date_min.slice(0, 4)}–${data.summary.date_max.slice(0, 4)} observation period`
                : "Transactions in dataset"
            }
          />
        </div>
      </section>

      <section className="stitch-overview-section" id="overview-changing">
        <SectionHeading title="Behaviour changes" note="Recent order and spending patterns" />
        <div className="stitch-overview-two-col">
          <article className="stitch-overview-card">
            <div className="stitch-card-heading">
              <div>
                <h2>Monthly Activity</h2>
                <span>
                  Orders and active customers
                  {latestActivity ? ` · Latest ${monthLabel(latestActivity.month)}` : ""}
                </span>
              </div>
            </div>
            {selectedActivity.length ? (
              <div className="stitch-overview-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={selectedActivity}
                    margin={{ top: 10, right: 38, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      yAxisId="orders"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      yAxisId="revenue"
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickFormatter={(value) =>
                        Number(value).toLocaleString("en-IN", {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        })
                      }
                    />
                    <Tooltip />
                    <Bar
                      yAxisId="orders"
                      dataKey="orders"
                      name="Orders"
                      fill="var(--primary)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={26}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="orders"
                      dataKey="active_customers"
                      name="Active customers"
                      stroke="var(--secondary)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    {selectedActivity.some((row) => row.revenue != null) && (
                      <Line
                        yAxisId="revenue"
                        dataKey="revenue"
                        name="Revenue"
                        stroke="#b38a3f"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyMessage>No monthly activity is available for this dataset.</EmptyMessage>
            )}
            <div className="stitch-chart-legend">
              <span>
                <i />
                Orders
              </span>
              <span>
                <i className="legend-active" />
                Active customers
              </span>
              {selectedActivity.some((row) => row.revenue != null) && (
                <span>
                  <i className="legend-revenue" />
                  Revenue
                </span>
              )}
            </div>
          </article>
          <article className="stitch-overview-card">
            <div className="stitch-card-heading">
              <div>
                <h2>Observed 30-Day Return Trend</h2>
                <span>Observed historical outcomes</span>
              </div>
              <span className="stitch-observed-tag">Observed</span>
            </div>
            {trend.length ? (
              <ReturnTrend />
            ) : (
              <EmptyMessage>Observed return history is not available.</EmptyMessage>
            )}
            <div className="stitch-observed-summary">
              <strong>
                {latestObserved ? `${Math.round(Number(latestObserved.return_rate) * 100)}%` : "—"}
              </strong>
              <span>Latest period actualized</span>
            </div>
            <p className="stitch-small-note">
              Observed history is separate from each customer’s forward-looking model estimate.
            </p>
          </article>
        </div>
      </section>

      <section className="stitch-overview-section">
        <SectionHeading
          title="Customer behaviour"
          note="Frequency, spending, and the leading risk driver"
        />
        <div className="stitch-velocity-grid">
          <BehaviourCard
            title="Ordering frequency"
            values={changes?.frequency}
            denominator={riskTotalForChanges}
          />
          <BehaviourCard
            title="Spending velocity"
            values={changes?.spending}
            denominator={
              Number(changes?.spending?.Decreasing || 0) +
              Number(changes?.spending?.Stable || 0) +
              Number(changes?.spending?.Increasing || 0)
            }
          />
          <article className="stitch-overview-card stitch-risk-factor">
            <span className="stitch-factor-kicker">Primary risk factor</span>
            <h2>{reasons[0]?.reason || "No leading driver available"}</h2>
            <p>
              {reasons[0]
                ? `${count(reasons[0].customers)} customers show this risk signal.`
                : "Risk drivers will appear when the analysis provides them."}
            </p>
            {reasons[0] && (
              <Link to="/customers" search={{ status: "At Risk", reason: reasons[0].reason }}>
                Review affected customers <ArrowUpRight size={14} />
              </Link>
            )}
          </article>
        </div>
      </section>

      <section className="stitch-overview-section" id="overview-affected">
        <SectionHeading
          title="Segmentation & Triage Queue"
          note="Customer status and individual behavioural scores"
        />
        <div className="stitch-overview-two-col">
          <article className="stitch-overview-card">
            <div className="stitch-card-heading">
              <div>
                <h2>Status Distribution</h2>
                <span>{count(total)} audited profiles</span>
              </div>
            </div>
            <div className="stitch-status-list">
              {[
                ["At Risk", atRisk, "risk"],
                ["Active", active, "active"],
                ["Loyal", loyal, "loyal"],
                ["Not scored", unscored, "neutral"],
              ].map(([label, value, tone]) => {
                const n = Number(value);
                const found = distribution.find((row) => row.status === label);
                return (
                  <div className={`stitch-status-row ${tone}`} key={String(label)}>
                    <span>{label}</span>
                    <div>
                      <i style={{ width: `${percent(n, total)}%` }} />
                    </div>
                    <b>{count(n)}</b>
                    <small>
                      {found?.share == null
                        ? `${percent(n, total)}%`
                        : `${Number(found.share).toFixed(1)}%`}
                    </small>
                  </div>
                );
              })}
            </div>
            {unscored > 0 && (
              <p className="stitch-status-footnote">
                <CircleHelp size={14} />
                {count(unscored)} profiles do not yet have enough purchase history for a stable
                cadence estimate.
              </p>
            )}
          </article>
          <article className="stitch-overview-card stitch-triage-card">
            <div className="stitch-card-heading">
              <div>
                <h2>Needs you first</h2>
                <span>Highest priority customers from the analysis</span>
              </div>
              <Link to="/customers" search={{ status: "At Risk" }}>
                View all {count(atRisk)} <ArrowUpRight size={14} />
              </Link>
            </div>
            {attention.length ? (
              <div className="stitch-triage-list">
                {attention.map((customer) => (
                  <div className="stitch-triage-row" key={customer.customer_id}>
                    <div className="stitch-triage-main">
                      <Link
                        to="/customers/$customerId"
                        params={{ customerId: customer.customer_id }}
                        className="stitch-triage-id"
                      >
                        {customer.customer_id}
                      </Link>
                      <span>Priority · {customer.priority || "Not available"}</span>
                      <StatusBadge status={customer.status} size="sm" />
                    </div>
                    <p>{customer.short_reason}</p>
                    <div className="stitch-triage-actions">
                      <span>
                        {customer.return_probability_pct == null
                          ? "Return estimate unavailable"
                          : `${customer.return_probability_pct}% estimated return`}
                      </span>
                      <Link
                        to="/customers/$customerId"
                        params={{ customerId: customer.customer_id }}
                      >
                        Open <ArrowUpRight size={13} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyMessage>No customers are flagged for priority review.</EmptyMessage>
            )}
          </article>
        </div>
      </section>

      <section className="stitch-overview-section" id="overview-why">
        <SectionHeading
          title="Root Cause Decomposition"
          note={
            atRisk
              ? `Primary drivers across ${count(atRisk)} at-risk customers`
              : "Risk drivers from the active analysis"
          }
        />
        <article className="stitch-overview-card stitch-driver-list">
          {approvedReasons.map((reason, index) => {
            const share = Number(
              reason.share_of_at_risk ??
                reason.share ??
                (atRisk ? (Number(reason.customers) / atRisk) * 100 : 0),
            );
            return (
              <div className="stitch-driver-row" key={reason.reason}>
                <div>
                  <span>{approvedDriverLabels[reason.reason]}</span>
                  <b>{count(reason.customers)}</b>
                  <Link to="/customers" search={{ status: "At Risk", reason: reason.reason }}>
                    Filter {share.toFixed(1)}%
                  </Link>
                </div>
                <div className="stitch-driver-track">
                  <i
                    className={`driver-color-${index}`}
                    style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
                  />
                </div>
              </div>
            );
          })}
          {!approvedReasons.length && (
            <EmptyMessage>Root-cause data is not available for this dataset.</EmptyMessage>
          )}
        </article>
      </section>

      <section className="stitch-overview-section" id="overview-actions">
        <SectionHeading
          title="Prescribed Action Plays"
          note="Recommended actions returned by the active analysis"
        />
        <div className="stitch-action-play-grid">
          {actions.slice(0, 3).map((action) => (
            <article className="stitch-overview-card stitch-action-play" key={action.action_type}>
              <div>
                <h2>{action.action_type}</h2>
                <strong>{count(action.customers)}</strong>
                <span>customers</span>
                {Number(action.high_priority) > 0 && (
                  <em>{count(action.high_priority)} high priority</em>
                )}
              </div>
              <p>Use the recommendation already associated with customers in this group.</p>
              <Link to="/outreach" className="stitch-action-link">
                Review at-risk audience <ArrowRight size={14} />
              </Link>
            </article>
          ))}
          {!actions.length && (
            <EmptyMessage>
              Recommended action groups are not available for this dataset.
            </EmptyMessage>
          )}
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="stitch-overview-section-heading">
      <h2>{title}</h2>
      <span>{note}</span>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  note,
  tone = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone?: string;
}) {
  return (
    <article className={`stitch-overview-metric ${tone}`}>
      <div>
        <span>{icon}</span>
        <label>{label}</label>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function BehaviourCard({
  title,
  values,
  denominator,
}: {
  title: string;
  values?: Record<string, number>;
  denominator: number;
}) {
  const declining = Number(values?.Decreasing || 0);
  const stable = Number(values?.Stable || 0);
  const increasing = Number(values?.Increasing || 0);
  return (
    <article className="stitch-overview-card stitch-behaviour-card">
      <h2>{title}</h2>
      <strong>
        {denominator ? `${percent(declining, denominator)}%` : "—"}
        <small> decreasing</small>
      </strong>
      <div className="stitch-behaviour-bar">
        <i style={{ width: `${percent(declining, denominator)}%` }} />
        <i style={{ width: `${percent(stable, denominator)}%` }} />
        <i style={{ width: `${percent(increasing, denominator)}%` }} />
      </div>
      <div className="stitch-behaviour-legend">
        <span>Decreasing · {count(declining)}</span>
        <span>Stable · {count(stable)}</span>
        <span>Increasing · {count(increasing)}</span>
      </div>
    </article>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <div className="stitch-section-empty">{children}</div>;
}
