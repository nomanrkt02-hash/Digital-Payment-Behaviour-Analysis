import { createFileRoute } from "@tanstack/react-router";
import { StitchOutreach } from "@/features/rhythm/stitch-outreach";
import { pageMeta } from "@/features/rhythm/shell";

export const Route = createFileRoute("/outreach")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search["customerId"] === "string"
      ? { customerId: search["customerId"] as string }
      : {}),
    ...(typeof search["q"] === "string" ? { q: search["q"] as string } : {}),
    ...(typeof search["status"] === "string" ? { status: search["status"] as string } : {}),
    ...(typeof search["priority"] === "string" ? { priority: search["priority"] as string } : {}),
    ...(typeof search["valueTier"] === "string"
      ? { valueTier: search["valueTier"] as string }
      : {}),
    ...(typeof search["reason"] === "string" ? { reason: search["reason"] as string } : {}),
    ...(typeof search["segment"] === "string" ? { segment: search["segment"] as string } : {}),
    ...(search["fromCustomers"] === true ? { fromCustomers: true } : {}),
  }),
  head: () => pageMeta("Outreach", "Select a customer audience and prepare suggested actions."),
  component: OutreachPage,
});

function OutreachPage() {
  const search = Route.useSearch();
  return <StitchOutreach key={JSON.stringify(search)} {...search} />;
}
