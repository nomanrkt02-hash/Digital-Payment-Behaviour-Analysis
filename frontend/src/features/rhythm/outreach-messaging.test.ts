import { describe, expect, it } from "vitest";
import { SAMPLE_DATA, type Customer } from "./data";
import {
  buildOutreachMessage,
  eligibleOfferValue,
  recommendedMessageKind,
} from "./outreach-messaging";

const customer = (index = 0, overrides: Partial<Customer> = {}): Customer =>
  ({ ...SAMPLE_DATA.customers[index], ...overrides }) as Customer;

describe("Outreach message recommendations", () => {
  it("creates distinct message, offer, and reminder drafts from customer data", () => {
    const target = customer(0);
    const options = { discountsAllowed: true, currency: "₹" };
    const message = buildOutreachMessage(target, "message", options).text;
    const offer = buildOutreachMessage(target, "offer", options);
    const reminder = buildOutreachMessage(target, "reminder", options).text;

    expect(message).toContain(target.customer_id);
    expect(offer.text).toContain("₹ 80");
    expect(offer.offerEligible).toBe(true);
    expect(reminder).not.toBe(message);
    expect(reminder).not.toBe(offer.text);
  });

  it("only offers a positive backend recommendation when discounts are enabled", () => {
    expect(eligibleOfferValue(customer(0), true)).toBe(80);
    expect(eligibleOfferValue(customer(0), false)).toBeNull();
    expect(eligibleOfferValue(customer(1), true)).toBeNull();
    expect(eligibleOfferValue(customer(0, { offer_value: 0 }), true)).toBeNull();
  });

  it("chooses the recommended draft type without treating unqualified customers as offer recipients", () => {
    expect(recommendedMessageKind(customer(0), true)).toBe("offer");
    expect(recommendedMessageKind(customer(1), true)).toBe("message");
    expect(recommendedMessageKind(customer(2, { action_type: "Timely reminder", offer_value: null }), true)).toBe("reminder");
    expect(recommendedMessageKind(customer(0), false)).not.toBe("offer");
  });

  it("uses neutral copy when an offer is unavailable and handles missing context", () => {
    const target = customer(0, {
      offer_value: 0,
      recency_days: undefined,
      usual_order_interval: undefined,
    });
    const result = buildOutreachMessage(target, "offer", {
      discountsAllowed: true,
      currency: "₹",
    });
    expect(result.offerEligible).toBe(false);
    expect(result.text).not.toMatch(/undefined|NaN|₹/);
    expect(buildOutreachMessage(target, "reminder", {
      discountsAllowed: true,
      currency: "₹",
    }).text).not.toMatch(/undefined|NaN/);
  });
});
