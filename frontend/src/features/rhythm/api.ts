import { setSampleData } from "./data";

const API_BASE =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000";

type ApiStats = {
  rows?: number;
  customers?: number;
  repeat_customers?: number;
  date_min?: string;
  date_max?: string;
  history_days?: number;
  [key: string]: unknown;
};

export type ApiPayload = {
  ok: boolean;
  message?: string;
  summary?: {
    total_orders?: number;
    total_customers?: number;
    not_enough_history?: number;
    data_label?: string;
    [key: string]: unknown;
  };
  validation?: {
    is_valid?: boolean;
    errors?: string[];
    warnings?: string[];
    stats?: ApiStats & { columns_found?: string[] };
    column_map?: Record<string, string>;
  };
  analytics?: {
    data_quality?: {
      available_columns?: string[];
      rows_uploaded?: number;
      customers?: number;
      rows_used?: number;
      date_min?: string;
      date_max?: string;
      total_missing?: number;
      duplicates_removed?: number;
      cancelled_removed?: number;
      invalid_removed?: number;
      quality_status?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  notes?: string[];
  [key: string]: unknown;
};

export class ApiRequestError extends Error {
  validation?: ApiPayload["validation"];

  constructor(message: string, validation?: ApiPayload["validation"]) {
    super(message);
    this.name = "ApiRequestError";
    this.validation = validation;
  }
}

export type WelcomePreview = {
  ok: true;
  summary: {
    data_label: string;
    total_customers: number;
    at_risk: number;
    total_orders: number;
    avg_return_probability: number | null;
    date_min: string;
    date_max: string;
  };
  status_distribution: { status: string; customers: number; share: number }[];
  risk_example: {
    reason: string;
    reason_customers: number;
    suggested_action: string;
    action_customers: number;
  } | null;
};

async function readResponse(response: Response): Promise<ApiPayload> {
  const body: unknown = await response.json().catch(() => ({}));
  const bodyObject = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (!response.ok) {
    const detail = bodyObject["detail"];
    const detailObject =
      detail && typeof detail === "object" ? (detail as Record<string, unknown>) : {};
    const errors = detailObject["errors"];
    const messages = Array.isArray(errors)
      ? errors.filter((message): message is string => typeof message === "string")
      : [];
    const responseMessage =
      typeof detail === "string"
        ? detail
        : messages.join(" ") ||
          (typeof detailObject["message"] === "string" ? detailObject["message"] : "") ||
          (typeof bodyObject["message"] === "string" ? bodyObject["message"] : "") ||
          `Request failed (${response.status}).`;
    const msg = /^The file could not be read\b/i.test(responseMessage)
      ? "File could not be read. Upload a valid, non-corrupted CSV or XLSX file."
      : responseMessage;
    const validation = detailObject["validation"];
    const validationObject =
      validation && typeof validation === "object"
        ? (validation as ApiPayload["validation"])
        : {
            errors: messages,
            warnings: Array.isArray(detailObject["warnings"])
              ? detailObject["warnings"].filter(
                  (warning): warning is string => typeof warning === "string",
                )
              : [],
            stats:
              detailObject["stats"] && typeof detailObject["stats"] === "object"
                ? (detailObject["stats"] as ApiStats & { columns_found?: string[] })
                : undefined,
          };
    throw new ApiRequestError(msg, validationObject);
  }
  return body as ApiPayload;
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "The local analysis service could not be reached. Start the project with START_PROJECT.bat, then retry.",
      );
    }
    throw error;
  }
}

export async function loadDemoData(): Promise<ApiPayload> {
  const payload = await readResponse(await request(`${API_BASE}/api/demo`, { method: "POST" }));
  setSampleData(payload);
  return payload;
}

export async function analyseUploadedFile(file: File): Promise<ApiPayload> {
  const form = new FormData();
  form.append("file", file);
  const payload = await readResponse(
    await request(`${API_BASE}/api/analyze`, { method: "POST", body: form }),
  );
  setSampleData(payload);
  return payload;
}

export async function loadCurrentData(): Promise<ApiPayload | null> {
  const response = await fetch(`${API_BASE}/api/current`).catch(() => null);
  if (!response || !response.ok) return null;
  const body: unknown = await response.json().catch(() => null);
  const payload = body && typeof body === "object" ? (body as ApiPayload) : null;
  if (payload?.ok) setSampleData(payload);
  return payload;
}

export async function loadWelcomePreview(): Promise<WelcomePreview> {
  return (await readResponse(await request(`${API_BASE}/api/preview`))) as WelcomePreview;
}

export async function updateBusinessRules(settings: {
  currency: string;
  max_discount: number;
  allow_discounts: boolean;
}): Promise<ApiPayload> {
  const payload = await readResponse(
    await request(`${API_BASE}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }),
  );
  setSampleData(payload);
  return payload;
}
