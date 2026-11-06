import { createFileRoute } from "@tanstack/react-router";
import { CustomerDetail } from "@/features/rhythm/detail";
import { pageMeta } from "@/features/rhythm/shell";
export const Route = createFileRoute("/customers/$customerId")({
  head: ({ params }) =>
    pageMeta(
      `${params.customerId} · Customer detail`,
      "Understand this customer’s ordering behaviour, return likelihood and suggested action.",
    ),
  component: DetailPage,
});
function DetailPage() {
  const { customerId } = Route.useParams();
  return <CustomerDetail customerId={customerId} />;
}
