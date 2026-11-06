import { useSyncExternalStore } from "react";

export let DATA_LOADED = false;
export type Transaction = {
  customer_id: string;
  order_id: string;
  order_date: string;
  amount: number;
  category?: string;
  payment_method?: string;
  order_status?: string;
  [key: string]: unknown;
};
let CURRENT_DATA: typeof SAMPLE_DATA | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const notify = () => listeners.forEach((listener) => listener());
export const SAMPLE_DATA = {
  summary: {
    total_customers: 658,
    at_risk: 216,
    active: 209,
    loyal: 227,
    not_enough_history: 6,
    avg_return_probability: 0.61,
    at_risk_high_value: 38,
    total_orders: 8886,
    date_min: "2025-01-01",
    date_max: "2026-02-28",
    snapshot_date: "2026-02-28",
    data_label: "Synthetic Demo Data",
  },
  customers: [
    {
      customer_id: "C001",
      return_probability: 0.17,
      return_probability_pct: 17,
      status: "At Risk",
      value_tier: "Medium",
      is_lapsed: false,
      priority: "Medium",
      short_reason: "Their usual 11–14 day rhythm has slowed.",
      why: [
        "Usually orders every 11-14 days",
        "45 days since last order",
        "That is about 3.6x longer than their usual gap",
        "Recent order frequency has decreased",
      ],
      recency_days: 45,
      usual_order_interval: 12.5,
      usual_interval_low: 11,
      usual_interval_high: 14,
      avg_order_value: 818,
      total_spend: 9816,
      monthly_spend: 1636,
      frequency: 2.4,
      active_months: 7,
      frequency_trend_label: "Decreasing",
      spending_trend_label: "Decreasing",
      favourite_category: "Food & Dining",
      favourite_payment_method: "UPI",
      first_order_date: "2025-08-25",
      last_order_date: "2026-01-14",
      action_type: "Retention offer",
      recommended_action:
        "Send a personalised retention offer: 10% off (about Rs 80) on Food & Dining, valid for ~12 days.",
      offer_value: 80,
    },
    {
      customer_id: "C002",
      return_probability: 0.99,
      return_probability_pct: 99,
      status: "Loyal / High-Value",
      value_tier: "High",
      is_lapsed: false,
      priority: "Low",
      short_reason: "A steady rhythm, with repeat orders every week.",
      why: [
        "Usually orders every 7-9 days",
        "3 days since last order",
        "Ordering frequency is stable",
        "Consistently active across 12 months",
      ],
      recency_days: 3,
      usual_order_interval: 8,
      usual_interval_low: 7,
      usual_interval_high: 9,
      avg_order_value: 2400,
      total_spend: 105600,
      monthly_spend: 8800,
      frequency: 3.8,
      active_months: 12,
      frequency_trend_label: "Stable",
      spending_trend_label: "Increasing",
      favourite_category: "Shopping",
      favourite_payment_method: "Credit card",
      first_order_date: "2025-02-01",
      last_order_date: "2026-02-25",
      action_type: "Loyalty recognition",
      recommended_action: "Recognise consistent loyalty with a personal thank-you message.",
      offer_value: null,
    },
    {
      customer_id: "C003",
      return_probability: 0.12,
      return_probability_pct: 12,
      status: "At Risk",
      value_tier: "High",
      is_lapsed: false,
      priority: "High",
      short_reason: "62 days without an order; usually every 17 days.",
      why: [
        "Usually orders every 15-19 days",
        "62 days since last order",
        "Current gap is 3.6x their usual interval",
        "Spending has decreased",
      ],
      recency_days: 62,
      usual_order_interval: 17,
      usual_interval_low: 15,
      usual_interval_high: 19,
      avg_order_value: 5200,
      total_spend: 57200,
      monthly_spend: 5200,
      frequency: 1.7,
      active_months: 10,
      frequency_trend_label: "Decreasing",
      spending_trend_label: "Decreasing",
      favourite_category: "Electronics",
      favourite_payment_method: "Credit card",
      first_order_date: "2025-03-02",
      last_order_date: "2025-12-28",
      action_type: "Strong retention incentive",
      recommended_action:
        "Reach out personally and offer a 15% incentive on their preferred Electronics category.",
      offer_value: 780,
    },
    {
      customer_id: "C004",
      return_probability: 0.96,
      return_probability_pct: 96,
      status: "Loyal / High-Value",
      value_tier: "Low",
      is_lapsed: false,
      priority: "Low",
      short_reason: "Small, frequent orders with a consistent weekly beat.",
      why: ["Usually orders every 6-8 days", "2 days since last order", "Frequency is stable"],
      recency_days: 2,
      usual_order_interval: 7,
      usual_interval_low: 6,
      usual_interval_high: 8,
      avg_order_value: 110,
      total_spend: 5500,
      monthly_spend: 440,
      frequency: 4,
      active_months: 12,
      frequency_trend_label: "Stable",
      spending_trend_label: "Stable",
      favourite_category: "Food & Dining",
      favourite_payment_method: "UPI",
      first_order_date: "2025-01-07",
      last_order_date: "2026-02-26",
      action_type: "Loyalty points",
      recommended_action: "Award loyalty points to recognise their regular ordering pattern.",
      offer_value: null,
    },
    {
      customer_id: "C005",
      return_probability: null,
      return_probability_pct: null,
      status: "Not enough history",
      value_tier: "Low",
      is_lapsed: false,
      priority: "Low",
      short_reason: "One order so far. Their rhythm is still emerging.",
      why: ["Only one order is available", "A usual ordering interval cannot be established yet"],
      recency_days: 5,
      usual_order_interval: 0,
      usual_interval_low: 0,
      usual_interval_high: 0,
      avg_order_value: 350,
      total_spend: 350,
      monthly_spend: 350,
      frequency: 1,
      active_months: 1,
      frequency_trend_label: "Stable",
      spending_trend_label: "Stable",
      favourite_category: "Shopping",
      favourite_payment_method: "UPI",
      first_order_date: "2026-02-23",
      last_order_date: "2026-02-23",
      action_type: "Welcome nudge",
      recommended_action:
        "Send a warm welcome and introduce their next-order benefits. Allow more history to develop.",
      offer_value: null,
    },
    {
      customer_id: "C006",
      return_probability: 0.52,
      return_probability_pct: 52,
      status: "Active / Normal",
      value_tier: "Medium",
      is_lapsed: false,
      priority: "Medium",
      short_reason: "A longer gap, but their recent activity remains stable.",
      why: [
        "Usually orders every 15-19 days",
        "50 days since last order",
        "Historical frequency remains stable",
      ],
      recency_days: 50,
      usual_order_interval: 17,
      usual_interval_low: 15,
      usual_interval_high: 19,
      avg_order_value: 950,
      total_spend: 11400,
      monthly_spend: 950,
      frequency: 1.8,
      active_months: 9,
      frequency_trend_label: "Stable",
      spending_trend_label: "Stable",
      favourite_category: "Travel",
      favourite_payment_method: "Debit card",
      first_order_date: "2025-05-01",
      last_order_date: "2026-01-09",
      action_type: "Early nudge",
      recommended_action:
        "Send a helpful reminder featuring their preferred Travel category, without a discount.",
      offer_value: null,
    },
    {
      customer_id: "C007",
      return_probability: 0.95,
      return_probability_pct: 95,
      status: "Active / Normal",
      value_tier: "Medium",
      is_lapsed: false,
      priority: "Low",
      short_reason: "Recent order falls comfortably within their usual pattern.",
      why: [
        "Usually orders every 10-13 days",
        "4 days since last order",
        "Spending remains stable",
      ],
      recency_days: 4,
      usual_order_interval: 11.5,
      usual_interval_low: 10,
      usual_interval_high: 13,
      avg_order_value: 720,
      total_spend: 18000,
      monthly_spend: 1440,
      frequency: 2.6,
      active_months: 10,
      frequency_trend_label: "Stable",
      spending_trend_label: "Stable",
      favourite_category: "Food & Dining",
      favourite_payment_method: "UPI",
      first_order_date: "2025-04-05",
      last_order_date: "2026-02-24",
      action_type: "Engagement nudge",
      recommended_action: "Share relevant new arrivals in Food & Dining to maintain engagement.",
      offer_value: null,
    },
    {
      customer_id: "C008",
      return_probability: 0.56,
      return_probability_pct: 56,
      status: "Active / Normal",
      value_tier: "Medium",
      is_lapsed: false,
      priority: "Medium",
      short_reason: "An extended gap warrants a gentle check-in.",
      why: [
        "Usually orders every 10-14 days",
        "35 days since last order",
        "Recent spending is stable",
      ],
      recency_days: 35,
      usual_order_interval: 12,
      usual_interval_low: 10,
      usual_interval_high: 14,
      avg_order_value: 680,
      total_spend: 13600,
      monthly_spend: 1360,
      frequency: 2.5,
      active_months: 9,
      frequency_trend_label: "Stable",
      spending_trend_label: "Stable",
      favourite_category: "Shopping",
      favourite_payment_method: "UPI",
      first_order_date: "2025-05-20",
      last_order_date: "2026-01-24",
      action_type: "Early nudge",
      recommended_action:
        "Send a friendly check-in and highlight their favourite Shopping category.",
      offer_value: null,
    },
    {
      customer_id: "C009",
      return_probability: 0.04,
      return_probability_pct: 4,
      status: "At Risk",
      value_tier: "High",
      is_lapsed: true,
      priority: "High",
      short_reason: "The beat has stopped: no order for 120 days.",
      why: [
        "Usually orders every 12-16 days",
        "120 days since last order",
        "Inactive for a very long time (lapsed)",
        "Ordering frequency has decreased",
      ],
      recency_days: 120,
      usual_order_interval: 14,
      usual_interval_low: 12,
      usual_interval_high: 16,
      avg_order_value: 3200,
      total_spend: 48000,
      monthly_spend: 0,
      frequency: 0,
      active_months: 8,
      frequency_trend_label: "Decreasing",
      spending_trend_label: "Decreasing",
      favourite_category: "Fashion",
      favourite_payment_method: "Credit card",
      first_order_date: "2025-02-01",
      last_order_date: "2025-10-31",
      action_type: "Win-back offer",
      recommended_action:
        "Send a personal win-back message with a 15% offer on Fashion. Respect their communication preferences.",
      offer_value: 480,
    },
    {
      customer_id: "C010",
      return_probability: 0.23,
      return_probability_pct: 23,
      status: "At Risk",
      value_tier: "Medium",
      is_lapsed: false,
      priority: "Medium",
      short_reason: "Order frequency has fallen over the last two months.",
      why: [
        "Usually orders every 8-12 days",
        "38 days since last order",
        "Recent order frequency has decreased",
      ],
      recency_days: 38,
      usual_order_interval: 10,
      usual_interval_low: 8,
      usual_interval_high: 12,
      avg_order_value: 640,
      total_spend: 15360,
      monthly_spend: 640,
      frequency: 1,
      active_months: 10,
      frequency_trend_label: "Decreasing",
      spending_trend_label: "Decreasing",
      favourite_category: "Groceries",
      favourite_payment_method: "UPI",
      first_order_date: "2025-04-01",
      last_order_date: "2026-01-21",
      action_type: "Retention offer",
      recommended_action:
        "Offer 10% off their next grocery order to encourage a return to their usual rhythm.",
      offer_value: 64,
    },
    {
      customer_id: "C011",
      return_probability: 0.31,
      return_probability_pct: 31,
      status: "At Risk",
      value_tier: "Low",
      is_lapsed: false,
      priority: "Low",
      short_reason: "Their current gap is more than twice the usual interval.",
      why: [
        "Usually orders every 18-22 days",
        "48 days since last order",
        "Spending has decreased",
      ],
      recency_days: 48,
      usual_order_interval: 20,
      usual_interval_low: 18,
      usual_interval_high: 22,
      avg_order_value: 280,
      total_spend: 3360,
      monthly_spend: 280,
      frequency: 1,
      active_months: 8,
      frequency_trend_label: "Decreasing",
      spending_trend_label: "Decreasing",
      favourite_category: "Food & Dining",
      favourite_payment_method: "UPI",
      first_order_date: "2025-06-01",
      last_order_date: "2026-01-11",
      action_type: "Engagement nudge",
      recommended_action: "Send a relevant reminder about Food & Dining without a discount.",
      offer_value: null,
    },
    {
      customer_id: "C012",
      return_probability: 0.91,
      return_probability_pct: 91,
      status: "Loyal / High-Value",
      value_tier: "Medium",
      is_lapsed: false,
      priority: "Low",
      short_reason: "A reliable fortnightly ordering rhythm.",
      why: [
        "Usually orders every 12-16 days",
        "6 days since last order",
        "Frequency has increased",
      ],
      recency_days: 6,
      usual_order_interval: 14,
      usual_interval_low: 12,
      usual_interval_high: 16,
      avg_order_value: 1250,
      total_spend: 30000,
      monthly_spend: 2500,
      frequency: 2.3,
      active_months: 12,
      frequency_trend_label: "Increasing",
      spending_trend_label: "Increasing",
      favourite_category: "Groceries",
      favourite_payment_method: "Debit card",
      first_order_date: "2025-02-02",
      last_order_date: "2026-02-22",
      action_type: "Loyalty points",
      recommended_action: "Reward their consistent activity with loyalty points.",
      offer_value: null,
    },
    {
      customer_id: "C013",
      return_probability: 0.74,
      return_probability_pct: 74,
      status: "Active / Normal",
      value_tier: "High",
      is_lapsed: false,
      priority: "Low",
      short_reason: "Following their regular monthly pattern.",
      why: [
        "Usually orders every 26-34 days",
        "18 days since last order",
        "Frequency and spending are stable",
      ],
      recency_days: 18,
      usual_order_interval: 30,
      usual_interval_low: 26,
      usual_interval_high: 34,
      avg_order_value: 4500,
      total_spend: 45000,
      monthly_spend: 4500,
      frequency: 1,
      active_months: 10,
      frequency_trend_label: "Stable",
      spending_trend_label: "Stable",
      favourite_category: "Electronics",
      favourite_payment_method: "Credit card",
      first_order_date: "2025-05-01",
      last_order_date: "2026-02-10",
      action_type: "Engagement nudge",
      recommended_action:
        "Share relevant Electronics updates, without changing their regular rhythm.",
      offer_value: null,
    },
    {
      customer_id: "C014",
      return_probability: null,
      return_probability_pct: null,
      status: "Not enough history",
      value_tier: "Medium",
      is_lapsed: false,
      priority: "Low",
      short_reason: "A new customer with only one recorded order.",
      why: ["Only one order is available", "More orders are needed to understand their rhythm"],
      recency_days: 2,
      usual_order_interval: 0,
      usual_interval_low: 0,
      usual_interval_high: 0,
      avg_order_value: 900,
      total_spend: 900,
      monthly_spend: 900,
      frequency: 1,
      active_months: 1,
      frequency_trend_label: "Stable",
      spending_trend_label: "Stable",
      favourite_category: "Travel",
      favourite_payment_method: "UPI",
      first_order_date: "2026-02-26",
      last_order_date: "2026-02-26",
      action_type: "Welcome nudge",
      recommended_action: "Send a welcome message with useful information for their next purchase.",
      offer_value: null,
    },
  ],
  customer_detail: {
    customer_id: "C001",
    order_dates: [187, 172, 160, 146, 133, 121, 108, 95, 83, 70, 58, 45],
    last_order_date: "2026-01-14",
    snapshot_date: "2026-02-28",
    usual_interval_low_days: 11,
    usual_interval_high_days: 14,
    expected_next_order_from: "2026-01-25",
    expected_next_order_until: "2026-01-28",
    days_past_usual_window: 31,
  },
  orders: [] as Transaction[],
  model_info: null as { source?: string; model_name?: string; horizon_days?: number } | null,
  cleaning_report: null as Record<string, unknown> | null,
  notes: [] as string[],
  analytics: {
    status_distribution: [
      { status: "At Risk", customers: 216, share: 32.8 },
      { status: "Active / Normal", customers: 209, share: 31.8 },
      { status: "Loyal / High-Value", customers: 227, share: 34.5 },
      { status: "Not enough history", customers: 6, share: 0.9 },
    ],
    attention: [
      {
        customer_id: "C003",
        status: "At Risk",
        short_reason: "62 days without an order; usually every 17 days.",
        priority: "High",
        value_tier: "High",
        return_probability_pct: 12,
        recency_days: 62,
        usual_order_interval: 17,
      },
      {
        customer_id: "C009",
        status: "At Risk",
        short_reason: "No order for 120 days. Their rhythm has stopped.",
        priority: "High",
        value_tier: "High",
        return_probability_pct: 4,
        recency_days: 120,
        usual_order_interval: 14,
      },
      {
        customer_id: "C001",
        status: "At Risk",
        short_reason: "45 days since last order; usually every 11–14 days.",
        priority: "Medium",
        value_tier: "Medium",
        return_probability_pct: 17,
        recency_days: 45,
        usual_order_interval: 12.5,
      },
      {
        customer_id: "C010",
        status: "At Risk",
        short_reason: "Order frequency has fallen over the last two months.",
        priority: "Medium",
        value_tier: "Medium",
        return_probability_pct: 23,
        recency_days: 38,
        usual_order_interval: 10,
      },
      {
        customer_id: "C011",
        status: "At Risk",
        short_reason: "Their current gap is more than twice the usual interval.",
        priority: "Low",
        value_tier: "Low",
        return_probability_pct: 31,
        recency_days: 48,
        usual_order_interval: 20,
      },
    ],
    reasons: [
      { reason: "Order gap much longer than usual", customers: 168, share_of_at_risk: 77.8 },
      { reason: "Ordering frequency has decreased", customers: 142, share_of_at_risk: 65.7 },
      { reason: "Spending has decreased", customers: 96, share_of_at_risk: 44.4 },
      { reason: "Inactive for a very long time", customers: 34, share_of_at_risk: 15.7 },
    ],
    actions: [
      { action_type: "Retention offer", customers: 122, high_priority: 23 },
      { action_type: "Strong retention incentive", customers: 34, high_priority: 34 },
      { action_type: "Win-back offer", customers: 34, high_priority: 18 },
      { action_type: "Engagement nudge", customers: 163, high_priority: 0 },
      { action_type: "Early nudge", customers: 72, high_priority: 0 },
      { action_type: "Loyalty recognition", customers: 109, high_priority: 0 },
      { action_type: "Loyalty points", customers: 118, high_priority: 0 },
      { action_type: "Welcome nudge", customers: 6, high_priority: 0 },
    ],
    behaviour_changes: {
      frequency: { Decreasing: 216, Stable: 312, Increasing: 124 },
      spending: { Decreasing: 158, Stable: 348, Increasing: 146 },
      past_usual_interval: 246,
      far_past_usual_interval: 168,
    },
    segments: [
      {
        segment: "Loyal",
        kind: "status",
        customers: 227,
        share: 34.5,
        avg_order_value: 1640,
        avg_usual_interval_days: 9.4,
        avg_days_since_last_order: 5,
        avg_return_probability_pct: 94,
      },
      {
        segment: "Active / Normal",
        kind: "status",
        customers: 209,
        share: 31.8,
        avg_order_value: 1080,
        avg_usual_interval_days: 15.2,
        avg_days_since_last_order: 18,
        avg_return_probability_pct: 68,
      },
      {
        segment: "At Risk",
        kind: "status",
        customers: 216,
        share: 32.8,
        avg_order_value: 1240,
        avg_usual_interval_days: 14.5,
        avg_days_since_last_order: 52,
        avg_return_probability_pct: 22,
      },
      {
        segment: "High Value",
        kind: "value",
        customers: 146,
        share: 22.2,
        avg_order_value: 4200,
        avg_usual_interval_days: 18,
        avg_days_since_last_order: 24,
        avg_return_probability_pct: 63,
      },
      {
        segment: "Emerging / New",
        kind: "history",
        customers: 6,
        share: 0.9,
        avg_order_value: 420,
        avg_usual_interval_days: 0,
        avg_days_since_last_order: 4,
        avg_return_probability_pct: null,
      },
    ],
    return_trend: [
      { snapshot: "2025-03", customers: 430, returned: 275, return_rate: 0.64 },
      { snapshot: "2025-04", customers: 452, returned: 312, return_rate: 0.69 },
      { snapshot: "2025-05", customers: 478, returned: 330, return_rate: 0.69 },
      { snapshot: "2025-06", customers: 491, returned: 359, return_rate: 0.73 },
      { snapshot: "2025-07", customers: 512, returned: 374, return_rate: 0.73 },
      { snapshot: "2025-08", customers: 536, returned: 370, return_rate: 0.69 },
      { snapshot: "2025-09", customers: 554, returned: 410, return_rate: 0.74 },
      { snapshot: "2025-10", customers: 576, returned: 455, return_rate: 0.79 },
      { snapshot: "2025-11", customers: 594, returned: 451, return_rate: 0.76 },
      { snapshot: "2025-12", customers: 612, returned: 502, return_rate: 0.82 },
      { snapshot: "2026-01", customers: 638, returned: 498, return_rate: 0.78 },
      { snapshot: "2026-02", customers: 658, returned: 520, return_rate: 0.79 },
    ],
    monthly_activity: [
      { month: "2025-03", orders: 542, active_customers: 275, revenue: 640000 },
      { month: "2025-04", orders: 580, active_customers: 312, revenue: 685000 },
      { month: "2025-05", orders: 612, active_customers: 330, revenue: 718000 },
      { month: "2025-06", orders: 648, active_customers: 359, revenue: 765000 },
      { month: "2025-07", orders: 675, active_customers: 374, revenue: 810000 },
      { month: "2025-08", orders: 646, active_customers: 370, revenue: 776000 },
      { month: "2025-09", orders: 702, active_customers: 410, revenue: 842000 },
      { month: "2025-10", orders: 756, active_customers: 455, revenue: 907000 },
      { month: "2025-11", orders: 740, active_customers: 451, revenue: 888000 },
      { month: "2025-12", orders: 820, active_customers: 502, revenue: 984000 },
      { month: "2026-01", orders: 795, active_customers: 498, revenue: 954000 },
      { month: "2026-02", orders: 838, active_customers: 520, revenue: 1005000 },
    ],
    data_quality: {
      rows_uploaded: 9079,
      rows_used: 8886,
      customers: 658,
      date_min: "2025-01-01",
      date_max: "2026-02-28",
      total_missing: 12,
      duplicates_removed: 0,
      cancelled_removed: 168,
      invalid_removed: 25,
      available_columns: [
        "customer_id",
        "order_id",
        "order_date",
        "amount",
        "category",
        "payment_method",
        "order_status",
      ],
      has_amount: true,
      has_category: true,
      has_payment_method: true,
      quality_status: "Usable - review warnings",
      warnings: [
        "168 cancelled/failed orders will be excluded from analysis.",
        "25 rows have an invalid order_date and will be removed.",
      ],
    },
    insight:
      "168 of 216 at-risk customers are well past their usual ordering window. A personal check-in can help reconnect before the rhythm is lost.",
  },
  validation: {
    is_valid: true,
    errors: [] as string[],
    warnings: [
      "168 cancelled/failed orders will be excluded from analysis.",
      "25 rows have an invalid order_date and will be removed.",
    ],
    stats: {
      rows: 9079,
      customers: 658,
      repeat_customers: 652,
      date_min: "2025-01-01",
      date_max: "2026-02-28",
      history_days: 423,
    },
  },
};
export type Customer = (typeof SAMPLE_DATA.customers)[number] & {
  email?: string;
  customer_email?: string;
  email_address?: string;
  overdue_ratio?: number;
  recent_order_count_90?: number;
  recent_aov_ratio?: number;
};
export function datasetSource(dataLabel: unknown): string {
  const label = String(dataLabel ?? "");
  if (/synthetic\s+demo/i.test(label)) return "Synthetic Demo Dataset";
  if (/uci.*online[ _-]+retail[ _-]*ii|online[ _-]+retail[ _-]*ii/i.test(label))
    return "UCI Online Retail II";
  return label ? "Uploaded Dataset" : "Not available";
}
export const STATUS_SENTENCES: Record<string, string> = {
  "At Risk": "This customer is ordering less often than usual.",
  "Active / Normal": "This customer is following their usual ordering pattern.",
  "Loyal / High-Value": "This customer is consistently active and loyal.",
  "Not enough history": "This customer has too few orders to judge their behaviour yet.",
};
export const statusClass = (status: string) =>
  status === "At Risk"
    ? "risk"
    : status === "Active / Normal"
      ? "active"
      : status === "Loyal / High-Value"
        ? "loyal"
        : "neutral";
export const statusLabel = (status: string) =>
  status === "At Risk"
    ? "At risk"
    : status === "Active / Normal"
      ? "Active"
      : status === "Loyal / High-Value"
        ? "Loyal"
        : "Not scored";
export const likelihoodWord = (pct: number) => (pct < 40 ? "Low" : pct < 70 ? "Medium" : "High");
export let SNAPSHOT = SAMPLE_DATA.summary.snapshot_date;
export function orderDates(customer: Customer): string[] {
  const row = customer as Customer & { order_dates?: unknown[] };
  if (
    Array.isArray(row.order_dates) &&
    row.order_dates.length &&
    row.order_dates.every((value): value is string => typeof value === "string")
  )
    return row.order_dates;
  const detail = SAMPLE_DATA.customer_detail;
  if (detail?.customer_id === customer.customer_id && Array.isArray(detail.order_dates)) {
    const snapshot = Date.parse(detail.snapshot_date);
    return detail.order_dates.map((value: number) =>
      new Date(snapshot - value * 86400000).toISOString().slice(0, 10),
    );
  }
  if (customer.status === "Not enough history") return [customer.last_order_date];
  return [];
}

export let sampleTransactions: Transaction[] = SAMPLE_DATA.customers
  .flatMap((c) =>
    orderDates(c).map((date, i) => ({
      customer_id: c.customer_id,
      order_id: `ORD-${c.customer_id}-${String(i + 1).padStart(3, "0")}`,
      order_date: date,
      amount: c.avg_order_value,
      category: c.favourite_category,
      payment_method: c.favourite_payment_method,
      order_status: "Completed",
    })),
  )
  .sort((a, b) => b.order_date.localeCompare(a.order_date));

export function setSampleData(payload: unknown) {
  if (!payload || typeof payload !== "object") return;
  const result = payload as Record<string, unknown>;
  if (result["ok"] !== true) return;
  Object.assign(SAMPLE_DATA, result);
  CURRENT_DATA = SAMPLE_DATA;
  DATA_LOADED = true;
  SNAPSHOT = SAMPLE_DATA.summary.snapshot_date;
  sampleTransactions = Array.isArray(result["orders"]) ? (result["orders"] as Transaction[]) : [];
  notify();
}

export function useData() {
  return useSyncExternalStore(
    subscribe,
    () => CURRENT_DATA || SAMPLE_DATA,
    () => SAMPLE_DATA,
  );
}

export function useDataLoaded() {
  return useSyncExternalStore(
    subscribe,
    () => DATA_LOADED,
    () => false,
  );
}

/**
 * Computes calendar days between two date strings (YYYY-MM-DD),
 * guaranteed immune to client timezone offsets.
 */
export function calendarDaysBetween(fromDateStr: string, toDateStr: string): number {
  if (!fromDateStr || !toDateStr) return 0;
  const parts1 = fromDateStr.slice(0, 10).split("-").map(Number);
  const parts2 = toDateStr.slice(0, 10).split("-").map(Number);
  if (parts1.length < 3 || parts2.length < 3) return 0;
  const [y1, m1, d1] = parts1 as [number, number, number];
  const [y2, m2, d2] = parts2 as [number, number, number];
  if (isNaN(y1) || isNaN(m1) || isNaN(d1) || isNaN(y2) || isNaN(m2) || isNaN(d2)) return 0;
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / 86400000);
}

/**
 * Computes order gap and days past usual interval.
 * e.g., 44 days recency - 21 days usual interval = 23 days past usual interval.
 */
export function computeOrderGap(
  recencyDays: number,
  usualInterval: number | null | undefined,
  usualHigh?: number | null | undefined,
): {
  recency: number;
  usual: number;
  daysPastUsual: number;
  isPastUsual: boolean;
  orderGapLabel: string;
} {
  const recency = Math.round(recencyDays || 0);
  const usual = Math.round(usualHigh || usualInterval || 0);
  if (usual <= 0) {
    return {
      recency,
      usual: 0,
      daysPastUsual: 0,
      isPastUsual: false,
      orderGapLabel: `${recency}d since last order`,
    };
  }
  const daysPastUsual = Math.max(0, recency - usual);
  const isPastUsual = daysPastUsual > 0;
  const orderGapLabel = isPastUsual
    ? `${daysPastUsual}d past usual interval (${recency}d / ${usual}d)`
    : `${recency}d since last order (usual ${usual}d)`;
  return {
    recency,
    usual,
    daysPastUsual,
    isPastUsual,
    orderGapLabel,
  };
}
