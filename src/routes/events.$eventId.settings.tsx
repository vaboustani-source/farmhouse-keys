import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/events/$eventId/settings")({
  component: SettingsRedirect,
});

function SettingsRedirect() {
  const { eventId } = Route.useParams();
  return <Navigate to="/events/$eventId/edit" params={{ eventId }} replace />;
}