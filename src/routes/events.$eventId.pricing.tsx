import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/events/$eventId/pricing")({
  component: PricingRedirect,
});

function PricingRedirect() {
  const { eventId } = Route.useParams();
  // Pricing currently lives inside the event editor; route exists so the
  // sidebar item navigates to a stable URL.
  return <Navigate to="/events/$eventId/edit" params={{ eventId }} replace />;
}