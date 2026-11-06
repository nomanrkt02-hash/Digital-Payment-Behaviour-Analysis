import type { Customer } from "./data";

export type OutreachMessageKind = "message" | "offer" | "reminder";

const OFFER_ACTIONS = new Set([
  "Retention offer",
  "Strong retention offer",
  "Win-back offer",
]);

function finiteNonNegative(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function eligibleOfferValue(customer: Customer, discountsAllowed: boolean): number | null {
  if (!discountsAllowed || !OFFER_ACTIONS.has(customer.action_type || "")) return null;
  const value = finiteNonNegative(customer.offer_value);
  return value != null && value > 0 ? value : null;
}

export function recommendedMessageKind(
  customer: Customer | undefined,
  discountsAllowed: boolean,
): OutreachMessageKind {
  if (!customer) return "message";
  if (eligibleOfferValue(customer, discountsAllowed) != null) return "offer";
  if (/reminder|nudge/i.test(customer.action_type || "")) return "reminder";
  return "message";
}

function greeting(customer: Customer): string {
  const id = typeof customer.customer_id === "string" ? customer.customer_id.trim() : "";
  return id ? `Hi ${id},` : "Hi,";
}

function orderContext(customer: Customer): { days: number | null; interval: number | null } {
  return {
    days: finiteNonNegative(customer.recency_days),
    interval:
      finiteNonNegative(customer.usual_order_interval) &&
      Number(customer.usual_order_interval) > 0
        ? Number(customer.usual_order_interval)
        : null,
  };
}

function personalMessage(customer: Customer): string {
  const { days, interval } = orderContext(customer);
  const start = greeting(customer);
  if (customer.status === "At Risk") {
    if (days != null && interval != null && days > interval) {
      return `${start} it's been ${days} days since your last order, longer than your usual ${Math.round(interval)}-day gap. We'd love to see you again whenever you're ready.`;
    }
    if (days != null) {
      return `${start} it's been ${days} days since your last order. We'd love to see you again whenever you're ready.`;
    }
    return `${start} we'd love to see you again whenever you're ready.`;
  }
  if (customer.status === "Active / Normal") {
    if (days != null && interval != null) {
      return `${start} your usual order interval is about ${Math.round(interval)} days, and it's been ${days} days since your last order. Whenever you're ready, we're here.`;
    }
    return `${start} thanks for ordering with us. Whenever you need us again, we're here.`;
  }
  if (customer.status === "Loyal / High-Value") {
    const months = finiteNonNegative(customer.active_months);
    return months != null && months > 0
      ? `${start} thanks for coming back across ${Math.round(months)} active months. We appreciate it and look forward to seeing you again.`
      : `${start} thanks for continuing to choose us. We appreciate it and look forward to seeing you again.`;
  }
  return `${start} we'd love to have you back whenever you're ready. Feel free to order again when the time is right.`;
}

function offerMessage(
  customer: Customer,
  discountsAllowed: boolean,
  currency: string,
): { text: string; eligible: boolean } {
  const value = eligibleOfferValue(customer, discountsAllowed);
  if (value == null) {
    return {
      text: `${greeting(customer)} thanks for choosing us. We'd love to see you again whenever the time is right.`,
      eligible: false,
    };
  }
  const formatted = `${currency} ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return {
    text: `${greeting(customer)} we'd love to see you again. A ${formatted} offer is suggested for your next order, if you'd like to use it.`,
    eligible: true,
  };
}

function reminderMessage(customer: Customer): string {
  const { days, interval } = orderContext(customer);
  const start = greeting(customer);
  if (customer.status === "At Risk" && days != null && interval != null && days > interval) {
    return `${start} just a quick check-in: it's been ${days} days since your last order, beyond your usual ${Math.round(interval)}-day gap. Whenever you're ready, we're here.`;
  }
  if (customer.status === "Active / Normal" && days != null && interval != null && days >= interval * 0.75) {
    return `${start} you may be around your usual timing for another order. No rush; whenever you need us, we're here.`;
  }
  if (customer.status === "Loyal / High-Value") {
    return `${start} a quick reminder from us: thanks for choosing us regularly. Whenever you're ready for your next order, we're here.`;
  }
  if (customer.status === "Not enough history") {
    return `${start} a quick note from us: whenever you need us, we're here.`;
  }
  if (days != null) {
    return `${start} it's been ${days} days since your last order. Whenever you're ready for another, we're here.`;
  }
  return `${start} a quick reminder from us: whenever you're ready for another order, we're here.`;
}

export function buildOutreachMessage(
  customer: Customer,
  kind: OutreachMessageKind,
  options: { discountsAllowed: boolean; currency: string },
): { text: string; offerEligible?: boolean } {
  if (kind === "offer") {
    const offer = offerMessage(customer, options.discountsAllowed, options.currency);
    return { text: offer.text, offerEligible: offer.eligible };
  }
  return {
    text: kind === "reminder" ? reminderMessage(customer) : personalMessage(customer),
  };
}

