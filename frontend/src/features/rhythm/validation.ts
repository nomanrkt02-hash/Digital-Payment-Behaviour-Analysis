export type ValidationResult = {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  detected: string[];
  headers: string[];
  stats: {
    rows: number | null;
    customers: number | null;
    repeat_customers: number | null;
    date_min: string | null;
    date_max: string | null;
    history_days: number | null;
    missing_values: number | null;
    duplicates_removed: number | null;
    cancelled_removed: number | null;
    invalid_removed: number | null;
    quality_status: string | null;
    orders?: number | null;
    data_label?: string;
    columns_found?: string[];
    scored_customers?: number | null;
  };
  column_map?: Record<string, string>;
};
const aliases: Record<string, string[]> = {
  customer_id: ["customer_id", "customer", "customerid", "client_id"],
  order_id: ["order_id", "transaction_id", "orderid", "transactionid"],
  order_date: ["order_date", "transaction_date", "date", "orderdate"],
  amount: ["amount", "total", "order_amount", "transaction_amount"],
  category: ["category", "product_category"],
  payment_method: ["payment_method", "payment", "payment_type"],
  order_status: ["order_status", "status", "transaction_status"],
};
export function validateRows(rows: Record<string, unknown>[]): ValidationResult {
  const names = Object.keys(rows[0] ?? {});
  const normal = (s: string) => s.trim().toLowerCase().replace(/[ -]/g, "_");
  const detected: Record<string, string> = {};
  Object.entries(aliases).forEach(([key, list]) => {
    const name = names.find((n) => list.includes(normal(n)));
    if (name) detected[key] = name;
  });
  const errors = ["customer_id", "order_id", "order_date", "amount"]
    .filter((c) => !detected[c])
    .map((c) => `Missing required column: ${c}`);
  const warnings: string[] = [];
  const customers = new Map<string, number>();
  const seen = new Set<string>();
  const dates: number[] = [];
  let missing = 0,
    duplicates = 0,
    cancelled = 0,
    invalid = 0;
  for (const row of rows) {
    const get = (k: string) => row[detected[k] ?? ""];
    const id = String(get("customer_id") ?? "");
    const orderId = String(get("order_id") ?? "");
    const raw = get("order_date");
    let date =
      typeof raw === "number"
        ? Date.UTC(1899, 11, 30) + raw * 86400000
        : Date.parse(String(raw ?? ""));
    if (raw instanceof Date) date = raw.getTime();
    if (
      !id ||
      !orderId ||
      raw === undefined ||
      raw === "" ||
      get("amount") === undefined ||
      get("amount") === ""
    ) {
      missing++;
      continue;
    }
    if (/cancel|fail/i.test(String(get("order_status") ?? ""))) {
      cancelled++;
      continue;
    }
    if (
      !Number.isFinite(date) ||
      !Number.isFinite(Number(get("amount"))) ||
      Number(get("amount")) < 0
    ) {
      invalid++;
      continue;
    }
    const key = `${id}|${orderId}`;
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    customers.set(id, (customers.get(id) ?? 0) + 1);
    dates.push(date);
  }
  const repeat = Array.from(customers.values()).filter((n) => n > 1).length;
  if (!rows.length) errors.push("The file contains no transaction records.");
  if (!errors.length && !repeat)
    errors.push(
      "Insufficient history: no customer has more than one order, so behaviour cannot be learned.",
    );
  if (cancelled)
    warnings.push(`${cancelled} cancelled/failed orders will be excluded from analysis.`);
  if (invalid)
    warnings.push(`${invalid} rows have an invalid order_date or amount and will be removed.`);
  if (missing) warnings.push(`${missing} rows have missing required values and will be excluded.`);
  if (duplicates) warnings.push(`${duplicates} duplicate transactions will be removed.`);
  const min = dates.length ? dates.reduce((a, b) => Math.min(a, b), Infinity) : 0,
    max = dates.length ? dates.reduce((a, b) => Math.max(a, b), -Infinity) : 0;
  return {
    is_valid: !errors.length,
    errors,
    warnings,
    detected: Object.keys(detected),
    headers: names,
    stats: {
      rows: rows.length,
      customers: customers.size,
      repeat_customers: repeat,
      date_min: min ? new Date(min).toISOString().slice(0, 10) : "—",
      date_max: max ? new Date(max).toISOString().slice(0, 10) : "—",
      history_days: Math.round((max - min) / 86400000),
      missing_values: missing,
      duplicates_removed: duplicates,
      cancelled_removed: cancelled,
      invalid_removed: invalid,
      quality_status: errors.length
        ? "Blocked"
        : warnings.length
          ? "Usable - review warnings"
          : "Good",
    },
  };
}
export function fileFormatError(name: string) {
  const ext = name.includes(".") ? "." + name.split(".").pop()?.toLowerCase() : "";
  return [".csv", ".xlsx"].includes(ext)
    ? null
    : `Unsupported file format '${ext}'. Please upload a CSV or XLSX file.`;
}
