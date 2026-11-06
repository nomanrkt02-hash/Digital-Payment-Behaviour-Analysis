import { describe, it, expect } from "vitest";
import {
  SAMPLE_DATA,
  STATUS_SENTENCES,
  orderDates,
  statusLabel,
  computeOrderGap,
  calendarDaysBetween,
} from "./data";
import { DEFAULT_PREFERENCES } from "./preferences";
import { validateRows, fileFormatError } from "./validation";
describe("Product data rules", () => {
  it("retains the provided summary counts", () => {
    expect(SAMPLE_DATA.summary.total_customers).toBe(658);
    expect(SAMPLE_DATA.summary.at_risk).toBe(216);
    expect(SAMPLE_DATA.summary.active).toBe(209);
    expect(SAMPLE_DATA.summary.loyal).toBe(227);
    expect(SAMPLE_DATA.summary.not_enough_history).toBe(6);
    expect(216 + 209 + 227 + 6).toBe(SAMPLE_DATA.summary.total_customers);
  });
  it("C001 is 45 days after their order and 31 days past the usual upper window", () => {
    const c = SAMPLE_DATA.customers[0];
    expect(c?.usual_interval_low).toBe(11);
    expect(c?.usual_interval_high).toBe(14);
    expect(c?.recency_days).toBe(45);
    expect(c?.return_probability).toBe(0.17);
    expect(SAMPLE_DATA.customer_detail.days_past_usual_window).toBe(31);
    if (!c) throw new Error("Missing C001");
    const last = orderDates(c).at(-1);
    expect(last).toBe("2026-01-14");
    expect(
      (Date.parse(SAMPLE_DATA.summary.snapshot_date) - Date.parse(c.last_order_date)) / 86400000,
    ).toBe(45);
  });
  it("keeps low value separate from loyal status", () => {
    const c = SAMPLE_DATA.customers.find((c) => c.customer_id === "C004");
    expect(c?.status).toBe("Loyal / High-Value");
    expect(c?.value_tier).toBe("Low");
  });
  it("never assigns a probability to insufficient-history customers", () => {
    const customers = SAMPLE_DATA.customers.filter((c) => c.status === "Not enough history");
    expect(customers.length).toBeGreaterThan(0);
    for (const c of customers) {
      expect(c.return_probability).toBeNull();
      expect(c.return_probability_pct).toBeNull();
      expect(c.usual_order_interval).toBe(0);
    }
  });
  it("sets maximum discount to 15 percent", () => {
    expect(DEFAULT_PREFERENCES.maxDiscount).toBe(15);
  });
  it("preserves all four backend status mappings", () => {
    expect(statusLabel("At Risk")).toBe("At risk");
    expect(statusLabel("Active / Normal")).toBe("Active");
    expect(statusLabel("Loyal / High-Value")).toBe("Loyal");
    expect(statusLabel("Not enough history")).toBe("Not scored");
    expect(Object.keys(STATUS_SENTENCES)).toHaveLength(4);
  });
  it("verifies date arithmetic: 44 days - 21 days = 23 days past usual interval", () => {
    const gap = computeOrderGap(44, 21);
    expect(gap.recency).toBe(44);
    expect(gap.usual).toBe(21);
    expect(gap.daysPastUsual).toBe(23);
    expect(gap.isPastUsual).toBe(true);
    expect(gap.orderGapLabel).toContain("23d past usual interval");
  });
  it("correctly handles customers ordered 1 day ago with 30-day usual interval", () => {
    const gap = computeOrderGap(1, 30);
    expect(gap.recency).toBe(1);
    expect(gap.usual).toBe(30);
    expect(gap.daysPastUsual).toBe(0);
    expect(gap.isPastUsual).toBe(false);
    expect(gap.orderGapLabel).toBe("1d since last order (usual 30d)");
  });
  it("calculates timezone-immune calendar days between order and snapshot", () => {
    expect(calendarDaysBetween("2026-01-15", "2026-02-28")).toBe(44);
    expect(calendarDaysBetween("2026-01-15 00:00:00", "2026-02-28")).toBe(44);
    expect(calendarDaysBetween("2026-01-14", "2026-02-28")).toBe(45);
  });
});
describe("Actual local file validation", () => {
  it("blocks a missing customer_id column", () => {
    const r = validateRows([{ order_id: "1", order_date: "2025-01-01", amount: 10 }]);
    expect(r.is_valid).toBe(false);
    expect(r.errors).toContain("Missing required column: customer_id");
  });
  it("blocks files with no repeat history", () => {
    const r = validateRows([
      { customer_id: "1", order_id: "1", order_date: "2025-01-01", amount: 10 },
    ]);
    expect(r.errors).toContain(
      "Insufficient history: no customer has more than one order, so behaviour cannot be learned.",
    );
  });
  it("accepts common aliases and repeat customers", () => {
    const r = validateRows([
      { Customer: "1", transaction_id: "1", date: "2025-01-01", total: 10 },
      { Customer: "1", transaction_id: "2", date: "2025-02-01", total: 20 },
    ]);
    expect(r.is_valid).toBe(true);
    expect(r.stats.repeat_customers).toBe(1);
    expect(r.stats.history_days).toBe(31);
  });
  it("allows only CSV and XLSX", () => {
    expect(fileFormatError("sample.csv")).toBeNull();
    expect(fileFormatError("sample.xlsx")).toBeNull();
    expect(fileFormatError("sample.txt")).toBe(
      "Unsupported file format '.txt'. Please upload a CSV or XLSX file.",
    );
  });
});
