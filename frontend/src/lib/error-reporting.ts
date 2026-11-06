/**
 * Application runtime error logging.
 */
export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[Digital Payment Behaviour Analysis]", error, context);
}
