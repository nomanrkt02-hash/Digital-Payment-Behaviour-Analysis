import { createFileRoute } from "@tanstack/react-router";
import { StitchData } from "@/features/rhythm/stitch-data";
import { pageMeta } from "@/features/rhythm/shell";
export const Route = createFileRoute("/transactions")({
  head: () =>
    pageMeta("Data", "Review the active dataset, date coverage, quality and transaction records."),
  component: StitchData,
});
