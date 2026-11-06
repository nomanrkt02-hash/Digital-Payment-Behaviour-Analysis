import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { statusLabel, type Customer } from "./data";
import { recordPreparedAction } from "./prepared-actions";
import { useFormat, usePreferences } from "./preferences";
import { buildOutreachMessage, eligibleOfferValue, recommendedMessageKind } from "./outreach-messaging";

type ActionKind = "message" | "offer" | "reminder";
function customerEmail(customer: Customer | undefined) {
  const value = customer?.email || customer?.customer_email || customer?.email_address;
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : "";
}
function template(c: Customer, kind: ActionKind, supportedFieldsOnly = false) {
  const category = !supportedFieldsOnly && c.favourite_category ? ` in ${c.favourite_category}` : "";
  if (kind === "offer" && c.offer_value != null)
    return `Customer ${c.customer_id}: We would like to welcome you back${category}. A personalized offer is available for your next order.`;
  if (c.status === "Loyal / High-Value")
    return `Customer ${c.customer_id}: Thank you for being a valued and consistent customer${category}. We appreciate your continued support.`;
  if (c.status === "Not enough history")
    return `Customer ${c.customer_id}: Thank you for your recent order${category}. We hope to see you again soon.`;
  if (c.status === "At Risk")
    return `Customer ${c.customer_id}: We noticed it has been ${c.recency_days} days since your last order${category}. We would be glad to welcome you back.`;
  if (supportedFieldsOnly)
    return `Customer ${c.customer_id}: It has been ${c.recency_days} days since your last order${category}. This is a friendly reminder if you are ready to order again.`;
  return `Customer ${c.customer_id}: It has been ${c.recency_days} days since your last order${category}. Your usual order interval is about ${Math.round(Number(c.usual_order_interval))} days. This is a friendly reminder if you are ready to order again.`;
}
export function ActionComposer({
  customers,
  bulk = false,
  formatAction = (value) => value,
  formatCopy = (value) => value,
  supportedFieldsOnly = false,
  customerSpecificMessages = false,
}: {
  customers: Customer[];
  bulk?: boolean;
  formatAction?: (value: string) => string;
  formatCopy?: (value: string) => string;
  supportedFieldsOnly?: boolean;
  customerSpecificMessages?: boolean;
}) {
  const { preferences } = usePreferences();
  const discountsAllowed = preferences.allowDiscounts;
  const currency = preferences.currency;
  const [kind, setKind] = useState<ActionKind>(() => {
    const first = customers[0];
    if (customerSpecificMessages) return recommendedMessageKind(first, discountsAllowed);
    if (!bulk && first?.offer_value != null) return "offer";
    if (!bulk && first?.status === "Active / Normal") return "reminder";
    return "message";
  });
  const [previewId, setPreviewId] = useState(customers[0]?.customer_id || "");
  const [channel, setChannel] = useState("WhatsApp");
  const selected = customers.find((c) => c.customer_id === previewId) || customers[0];
  const { money } = useFormat();
  useEffect(() => {
    if (!customers.some((customer) => customer.customer_id === previewId)) {
      setPreviewId(customers[0]?.customer_id || "");
    }
  }, [customers, previewId]);
  const seed = useMemo(
    () => selected
      ? customerSpecificMessages
        ? buildOutreachMessage(selected, kind, { discountsAllowed, currency }).text
        : template(selected, kind, supportedFieldsOnly)
      : "",
    [selected, kind, supportedFieldsOnly, customerSpecificMessages, discountsAllowed, currency],
  );
  const [content, setContent] = useState(seed);
  const [state, setState] = useState("");
  useEffect(() => {
    setContent(seed);
    setState("");
  }, [seed]);
  const actionCounts = useMemo(
    () =>
      customers.reduce<Record<string, number>>((out, customer) => {
        const label = formatAction(customer.action_type || "Review customer");
        out[label] = (out[label] || 0) + 1;
        return out;
      }, {}),
    [customers, formatAction],
  );
  const strategies = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const availableEmails = customers.filter((customer) => customerEmail(customer)).length;
  const changeKind = (action: ActionKind) => {
    setKind(action);
    setContent(selected
      ? customerSpecificMessages
        ? buildOutreachMessage(selected, action, { discountsAllowed, currency }).text
        : template(selected, action, supportedFieldsOnly)
      : "");
    setState("");
  };
  const previewCustomer = (customer: Customer) => {
    setPreviewId(customer.customer_id);
    setContent(customerSpecificMessages
      ? buildOutreachMessage(customer, kind, { discountsAllowed, currency }).text
      : template(customer, kind, supportedFieldsOnly));
    setState("");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setState("Message copied.");
    } catch {
      setState("Clipboard access is unavailable in this browser.");
    }
  };
  const prepare = () => {
    recordPreparedAction({ count: customers.length, kind, preparedAt: new Date().toISOString() });
    setState(
      `${bulk ? "Review" : "Action"} prepared for ${customers.length.toLocaleString()} customer${customers.length === 1 ? "" : "s"}. Nothing was sent or scheduled.`,
    );
  };

  return (
    <section className="panel outreach-panel">
      <div className="outreach-title">
        <div>
          <div className="eyebrow">Take action</div>
          <h2>{bulk ? "Review audience actions" : "Customer action"}</h2>
        </div>
        <span className="sample-tag">{customers.length.toLocaleString()} selected</span>
      </div>
      {!customers.length ? (
        <p className="muted">No customers match this audience.</p>
      ) : (
        <>
          <div className="outreach-tabs" aria-label="Action type">
            {(["message", "offer", "reminder"] as const).map((action) => (
              <button
                key={action}
                type="button"
                aria-pressed={kind === action}
                onClick={() => changeKind(action)}
              >
                {action === "message" ? "Message" : action === "offer" ? "Offer" : "Reminder"}
              </button>
            ))}
          </div>
          {bulk && (
            <div className="bulk-strategy-review">
              <div className="outreach-strategy">
                <b>Recommended strategies</b>
                <div>
                  {strategies.map(([label, count]) => (
                    <span key={label}>
                      {label} · {count}
                    </span>
                  ))}
                </div>
              </div>
              <details className="bulk-review-list">
                <summary>
                  Review customers · first {Math.min(customers.length, 10)} of {customers.length}
                </summary>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Status</th>
                        <th>Value</th>
                        <th>Recommended</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {customers.slice(0, 10).map((customer) => (
                        <tr key={customer.customer_id}>
                          <td>{customer.customer_id}</td>
                          <td>{statusLabel(customer.status)}</td>
                          <td>{customer.value_tier}</td>
                          <td>{formatAction(customer.action_type || "Review customer")}</td>
                          <td>
                            <button
                              className="text-link"
                              type="button"
                              onClick={() => previewCustomer(customer)}
                            >
                              Preview
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}
          {selected && (
            <div className="outreach-recommendation">
              <div>
                <span>Recommended</span>
                <b>{formatAction(selected.action_type || "Review customer")}</b>
              </div>
              <div>
                <span>Why</span>
                <b>{formatCopy(selected.short_reason || "Based on available customer behaviour.")}</b>
              </div>
              <div>
                <span>Customer value</span>
                  <b>{selected.value_tier === "High" ? "High Value" : selected.value_tier}</b>
              </div>
              {kind === "offer" && (
                <div>
                  <span>Suggested offer</span>
                  <b>
                    {eligibleOfferValue(selected, discountsAllowed) == null
                      ? "No discount recommended"
                      : money(eligibleOfferValue(selected, discountsAllowed)!)}
                  </b>
                </div>
              )}
            </div>
          )}
          <div className="outreach-channel-row">
            <b>Channel</b>
            <div>
              {["WhatsApp", "SMS", "Email"].map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={channel === item}
                  className={channel === item ? "selected" : ""}
                  onClick={() => setChannel(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <span>{channel} · Not connected · Draft only</span>
          </div>
          {channel === "Email" && (
            <div className="email-readiness" role="status">
              <div>
                <b>Email available</b>
                <span>{availableEmails.toLocaleString()}</span>
              </div>
              <div>
                <b>Missing or invalid</b>
                <span>{(customers.length - availableEmails).toLocaleString()}</span>
              </div>
              <p>
                Email provider not connected. Review and copy a preview; sending is unavailable.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled
                title="Configure a delivery provider on the backend to enable email sending."
              >
                Connect Email
              </Button>
            </div>
          )}
          {channel === "Email" && (
            <div className="email-preview">
              <span>
                <b>To:</b> {customerEmail(selected) || "Email unavailable"}
              </span>
              <span>
                <b>Subject:</b> We’d love to see you again
              </span>
            </div>
          )}
          <label className="outreach-label">
            {customerSpecificMessages && bulk && selected && (
              <span className="outreach-preview-customer">Preview for {selected.customer_id}</span>
            )}
            {channel === "Email" ? "Email preview" : "Message"}
            <textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={copy}>
              <Copy size={16} />
              {channel === "Email" ? "Copy Email" : "Copy Message"}
            </Button>
            <Button onClick={prepare}>
              <Send size={16} />
              {kind === "message"
                ? "Prepare Message"
                : kind === "offer"
                  ? !selected || eligibleOfferValue(selected, discountsAllowed) == null
                    ? "Prepare Action"
                    : "Prepare Offer"
                  : "Prepare Reminder"}
            </Button>
          </div>
          {state && (
            <p className="outreach-result" role="status">
              <Check size={16} />
              {state}
            </p>
          )}
          {customerSpecificMessages && kind === "offer" && selected && eligibleOfferValue(selected, discountsAllowed) == null && (
            <p className="outreach-footnote">
              {discountsAllowed
                ? "No monetary offer is recommended for this customer. This draft contains no discount."
                : "Discounts are disabled in Settings. This draft contains no discount."}
            </p>
          )}
          <p className="outreach-footnote">
            Prepared only · delivery and reminder scheduling are not connected.
          </p>
        </>
      )}
    </section>
  );
}
