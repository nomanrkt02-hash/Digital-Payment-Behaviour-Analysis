import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Download, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { statusLabel, useData, type Customer } from "./data";
import { matchesRiskReason } from "./customers";
import { StatusBadge } from "./visuals";
import { ActionComposer } from "./actions";

type AudienceMode = "bulk" | "single";
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const approvedReasonLabels: Record<string, string> = {
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
const displayCopy = (value: string) =>
  displayAction(value).replace(/\bRhythm\b/gi, "order pattern");

export function StitchOutreach({
  customerId = "",
  q = "",
  status: initialStatus,
  priority: initialPriority = "",
  valueTier: initialValueTier = "",
  reason: initialReason = "",
  segment = "",
  fromCustomers = false,
}: {
  customerId?: string;
  q?: string;
  status?: string;
  priority?: string;
  valueTier?: string;
  reason?: string;
  segment?: string;
  fromCustomers?: boolean;
}) {
  const data = useData();
  const allCustomers = data.customers as Customer[];
  const [mode, setMode] = useState<AudienceMode>(customerId ? "single" : "bulk");
  const [status, setStatus] = useState(
    customerId ? "" : fromCustomers ? (initialStatus ?? "") : (initialStatus ?? "At Risk"),
  );
  const [priority, setPriority] = useState(initialPriority);
  const [valueTier, setValueTier] = useState(initialValueTier);
  const [reason, setReason] = useState(initialReason);
  const [query] = useState(q);
  const [inactiveSegment] = useState(segment === "lapsed");
  const [fromCustomerList] = useState(fromCustomers);
  const [singleId, setSingleId] = useState(customerId || allCustomers[0]?.customer_id || "");
  const reasons = [...(data.analytics.reasons || [])]
    .filter((item) => Boolean(approvedReasonLabels[item.reason]))
    .map((item) => ({ key: item.reason, label: approvedReasonLabels[item.reason] }));
  const filteredAudience = useMemo(
    () =>
      allCustomers.filter(
        (customer) =>
          (!status || customer.status === status) &&
          (!priority || customer.priority === priority) &&
          (!valueTier || customer.value_tier === valueTier) &&
          (!query || customer.customer_id.toLowerCase().includes(query.toLowerCase())) &&
          (!inactiveSegment || customer.is_lapsed) &&
          (!reason || matchesRiskReason(customer, reason)),
      ),
    [allCustomers, inactiveSegment, priority, query, reason, status, valueTier],
  );
  const audience =
    mode === "single"
      ? allCustomers.filter((customer) => customer.customer_id === singleId)
      : filteredAudience;
  const preview = audience[0];

  const exportAudience = () => {
    const fields: (keyof Customer)[] = [
      "customer_id",
      "status",
      "priority",
      "value_tier",
      "return_probability_pct",
      "recency_days",
      "action_type",
      "recommended_action",
    ];
    const csv = [
      fields.join(","),
      ...audience.map((customer) =>
        fields
          .map((field) =>
            csvCell(field === "status"
              ? statusLabel(customer.status)
              : field === "action_type"
                ? displayAction(String(customer[field] || ""))
                : field === "recommended_action"
                  ? displayCopy(String(customer[field] || ""))
                  : customer[field]),
          )
          .join(","),
      ),
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "retention-audience.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stitch-outreach">
      <header className="stitch-outreach-header">
        <div>
          <h1>Outreach</h1>
          <p>Prepare targeted retention interventions and re-engagement messages.</p>
          {customerId && (
            <small className="stitch-outreach-context">Preparing an action for {customerId}</small>
          )}
          {!customerId && fromCustomerList && (
            <div className="stitch-outreach-context">
              <small>
                Audience carried over from Customers · {filteredAudience.length.toLocaleString()}{" "}
                selected
                {query && ` · Customer ID contains “${query}”`}
              </small>
              <Link to="/outreach">Clear transferred filters</Link>
            </div>
          )}
        </div>
        <div className="stitch-outreach-mode" role="group" aria-label="Audience mode">
          <button type="button" aria-pressed={mode === "bulk"} onClick={() => setMode("bulk")}>
            Bulk audience
          </button>
          <button type="button" aria-pressed={mode === "single"} onClick={() => setMode("single")}>
            Single customer
          </button>
        </div>
      </header>
      <nav className="stitch-outreach-steps" aria-label="Outreach steps">
        <a className="current" href="#outreach-audience">
          <b>1</b>
          <span>
            <strong>Audience</strong>
            <small>Filter customers</small>
          </span>
        </a>
        <a href="#outreach-strategy">
          <b>2</b>
          <span>
            <strong>Strategy</strong>
            <small>Recommended action</small>
          </span>
        </a>
        <a href="#outreach-message">
          <b>3</b>
          <span>
            <strong>Message</strong>
            <small>Draft and inspect template</small>
          </span>
        </a>
      </nav>

      <div className="stitch-outreach-layout">
        <div className="stitch-outreach-main">
          <section className="stitch-outreach-panel" id="outreach-audience">
            <div className="stitch-outreach-panel-head">
              <div>
                <h2>Audience</h2>
                <p>
                  {mode === "bulk"
                    ? "Select customers using the available retention attributes."
                    : "Choose one customer from the active analysis."}
                </p>
              </div>
              <span>{audience.length.toLocaleString()} selected</span>
            </div>
            {mode === "bulk" ? (
              <div className="stitch-outreach-filters">
                <label>
                  Status
                  <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="">All statuses</option>
                    <option value="At Risk">At risk</option>
                    <option value="Active / Normal">Active</option>
                    <option value="Loyal / High-Value">Loyal</option>
                    <option value="Not enough history">Not scored</option>
                  </select>
                </label>
                <label>
                  Priority
                  <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                    <option value="">All priorities</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </label>
                <label>
                  Value tier
                  <select value={valueTier} onChange={(event) => setValueTier(event.target.value)}>
                    <option value="">All tiers</option>
                    <option value="High">High Value</option>
                    <option value="Medium">Medium Value</option>
                    <option value="Low">Low Value</option>
                  </select>
                </label>
                <label>
                  Behavioural driver
                  <select value={reason} onChange={(event) => setReason(event.target.value)}>
                    <option value="">All drivers</option>
                    {reasons.map((item) => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <label className="stitch-outreach-single-select">
                Search or select customer ID
                <select value={singleId} onChange={(event) => setSingleId(event.target.value)}>
                  {allCustomers.map((customer) => (
                    <option key={customer.customer_id} value={customer.customer_id}>
                      {customer.customer_id} ·{" "}
                      {customer.status === "At Risk"
                        ? "At risk"
                        : customer.status === "Active / Normal"
                          ? "Active"
                          : customer.status === "Loyal / High-Value"
                            ? "Loyal"
                            : "Not scored"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="stitch-outreach-selected">
              <div>
                <strong>
                  <Users size={15} /> {audience.length.toLocaleString()} customers selected
                </strong>
                <Button variant="outline" onClick={exportAudience} disabled={!audience.length}>
                  <Download size={13} /> Export audience CSV
                </Button>
              </div>
              <small>Selected customers</small>
              <div className="stitch-audience-chips">
                {audience.slice(0, 6).map((customer) => (
                  <Link
                    key={customer.customer_id}
                    to="/customers/$customerId"
                    params={{ customerId: customer.customer_id }}
                  >
                    <span>{customer.customer_id}</span>
                    <StatusBadge status={customer.status} />
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="stitch-outreach-panel stitch-strategy-panel" id="outreach-strategy">
            <div className="stitch-outreach-panel-head">
              <div>
                <h2>Retention strategy</h2>
                <p>Use each customer’s recommendation from the existing analysis.</p>
              </div>
              <span>{audience.length} targeted</span>
            </div>
            <div className="stitch-strategy-choice">
              <span />
              <div>
                <b>Use each customer’s recommended action</b>
                <small>Apply the recommendation already attached to each customer.</small>
              </div>
              <em>Default</em>
            </div>
            {audience.length ? (
              <div className="stitch-action-distribution">
                <b>Recommended action mix</b>
                <div>
                  {Object.entries(
                    audience.reduce<Record<string, number>>((counts, customer) => {
                      const action = displayAction(customer.action_type || "Recommendation unavailable");
                      counts[action] = (counts[action] || 0) + 1;
                      return counts;
                    }, {}),
                  )
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([action, count]) => (
                      <span key={action}>
                        {action} · {count.toLocaleString()}
                      </span>
                    ))}
                </div>
              </div>
            ) : (
              <p className="stitch-outreach-empty">No customers match the selected audience.</p>
            )}
          </section>

          <section id="outreach-message">
            <ActionComposer
              customers={audience}
              bulk={mode === "bulk"}
              formatAction={displayAction}
              formatCopy={displayCopy}
              customerSpecificMessages
            />
          </section>
        </div>

        <aside className="stitch-outreach-preview">
          <section className="stitch-outreach-panel">
            <div className="stitch-outreach-panel-head">
              <div>
                <h2>Preview</h2>
                <p>{mode === "bulk" ? "Audience sample" : "Selected customer context"}</p>
              </div>
              <span>Draft preview</span>
            </div>
            {preview ? (
              <>
                <div className="stitch-preview-customer-row">
                  <span>Current target</span>
                  <Link to="/customers/$customerId" params={{ customerId: preview.customer_id }}>
                    {preview.customer_id}
                  </Link>
                </div>
                <div className="stitch-outreach-message-preview">
                  <div>
                    <span>Target: {preview.customer_id}</span>
                    <b>{displayAction(preview.action_type || "Recommendation unavailable")}</b>
                  </div>
                  <p>
                    {displayCopy(preview.recommended_action ||
                      preview.short_reason ||
                      "Message content is unavailable for this customer.")}
                  </p>
                </div>
                <div className="stitch-preview-facts">
                  <span>
                    <small>Status</small>
                    <StatusBadge status={preview.status} />
                  </span>
                  <span>
                    <small>Value tier</small>
                    <b>{preview.value_tier === "High" ? "High Value" : preview.value_tier || "Not provided"}</b>
                  </span>
                  <span>
                    <small>Return estimate</small>
                    <b>
                      {preview.return_probability_pct == null
                        ? "Not scored"
                        : `${preview.return_probability_pct}%`}
                    </b>
                  </span>
                </div>
              </>
            ) : (
              <div className="stitch-outreach-empty">
                Choose a customer audience to preview its recommendation.
              </div>
            )}
          </section>
          <section className="stitch-outreach-delivery">
            <b>Message delivery</b>
            <p>
              Delivery channels are not connected. You can review, copy, and prepare drafts below.
            </p>
            <Button disabled>
              <Send size={14} /> Send
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}
