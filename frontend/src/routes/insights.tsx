import { createFileRoute } from "@tanstack/react-router";
import { StitchInsights } from "@/features/rhythm/stitch-insights";
import { pageMeta } from "@/features/rhythm/shell";
export const Route = createFileRoute("/insights")({
  head: () =>
    pageMeta(
      "Insights",
      "Understand customer risk drivers, behavioural groups and suggested business actions.",
    ),
  component: StitchInsights,
});
