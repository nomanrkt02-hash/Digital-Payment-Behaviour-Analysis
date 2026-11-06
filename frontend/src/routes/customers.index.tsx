import { createFileRoute } from "@tanstack/react-router";
import { StitchCustomers } from "@/features/rhythm/stitch-customers";
import { pageMeta } from "@/features/rhythm/shell";
export const Route = createFileRoute("/customers/")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { status?: string; value?: string; reason?: string } => ({
    ...(typeof s["status"] === "string" ? { status: s["status"] } : {}),
    ...(typeof s["value"] === "string" ? { value: s["value"] } : {}),
    ...(typeof s["reason"] === "string" ? { reason: s["reason"] } : {}),
  }),
  head: () =>
    pageMeta(
      "Customers",
      "Explore individual customer behaviour, return likelihood and retention status.",
    ),
  component: CustomersPage,
});
function CustomersPage() {
  const search = Route.useSearch();
  return (
    <StitchCustomers
      key={`${search.status}-${search.value}-${search.reason}`}
      initialStatus={search.status ?? ""}
      initialValue={search.value ?? ""}
      initialReason={search.reason ?? ""}
    />
  );
}
