import { createFileRoute } from "@tanstack/react-router";
import { Overview } from "@/features/rhythm/overview";
import { pageMeta } from "@/features/rhythm/shell";
export const Route = createFileRoute("/overview")({
  head: () =>
    pageMeta(
      "Overview",
      "Review customer behaviour, estimated 30-day return likelihood and customers needing attention.",
    ),
  component: Overview,
});
