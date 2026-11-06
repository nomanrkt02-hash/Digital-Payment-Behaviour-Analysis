import { createFileRoute } from "@tanstack/react-router";
import { Reports } from "@/features/rhythm/secondary";
import { pageMeta } from "@/features/rhythm/shell";
export const Route = createFileRoute("/reports")({
  head: () => pageMeta("Reports", "Export the active dataset analysis in CSV, Excel or HTML."),
  component: Reports,
});
