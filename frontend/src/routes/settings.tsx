import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/features/rhythm/secondary";
import { pageMeta } from "@/features/rhythm/shell";
export const Route = createFileRoute("/settings")({
  head: () =>
    pageMeta(
      "Workspace Settings",
      "Choose display preferences and prototype analysis configuration.",
    ),
  component: SettingsPage,
});
