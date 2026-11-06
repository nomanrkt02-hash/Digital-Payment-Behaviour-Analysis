const PREPARED_KEY = "dpba-prepared-actions";

export function recordPreparedAction(entry: { count: number; kind: string; preparedAt: string }) {
  try {
    const existing = JSON.parse(sessionStorage.getItem(PREPARED_KEY) || "[]") as unknown[];
    sessionStorage.setItem(PREPARED_KEY, JSON.stringify([...existing, entry]));
  } catch {
    // The prepared state remains visible for this page session if storage is unavailable.
  }
}

export function preparedActionSummary() {
  try {
    const entries = JSON.parse(sessionStorage.getItem(PREPARED_KEY) || "[]") as Array<{
      count?: number;
      kind?: string;
    }>;
    return {
      batches: entries.length,
      customers: entries.reduce((total, entry) => total + Number(entry.count || 0), 0),
      kinds: [...new Set(entries.map((entry) => entry.kind).filter(Boolean))].join(", "),
    };
  } catch {
    return { batches: 0, customers: 0, kinds: "" };
  }
}
