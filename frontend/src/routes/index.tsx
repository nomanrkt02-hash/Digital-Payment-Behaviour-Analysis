import { createFileRoute } from "@tanstack/react-router";
import { Welcome } from "@/features/rhythm/welcome";
export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { upload?: boolean } =>
    s["upload"] === true || s["upload"] === "true" ? { upload: true } : {},
  head: () => ({
    meta: [
      { title: "Digital Payment Behaviour Analysis" },
      {
        name: "description",
        content: "Analyse customer ordering behaviour and estimate 30-day return likelihood.",
      },
      { property: "og:title", content: "Digital Payment Behaviour Analysis" },
      {
        property: "og:description",
        content: "Analyse customer ordering behaviour and estimate 30-day return likelihood.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: WelcomePage,
});
function WelcomePage() {
  const { upload } = Route.useSearch();
  return <Welcome key={String(upload)} initialUpload={upload ?? false} />;
}
