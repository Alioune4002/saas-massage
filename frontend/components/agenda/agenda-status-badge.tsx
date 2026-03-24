import { Badge } from "@/components/ui/badge";
import type { AgendaState, BookingStatus } from "@/lib/api";

const agendaStateMap: Record<
  AgendaState,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }
> = {
  free: { label: "Libre", tone: "success" },
  pending: { label: "En attente", tone: "warning" },
  confirmed: { label: "Confirmé", tone: "info" },
  canceled: { label: "Annulé", tone: "danger" },
  blocked: { label: "Bloqué", tone: "neutral" },
  inactive: { label: "Désactivé", tone: "neutral" },
};

const bookingStatusMap: Record<
  BookingStatus,
  { label: string; tone: "warning" | "success" | "danger" }
> = {
  pending: { label: "En attente", tone: "warning" },
  confirmed: { label: "Confirmé", tone: "success" },
  canceled: { label: "Annulé", tone: "danger" },
};

export function AgendaStatusBadge({ state }: { state: AgendaState }) {
  const config = agendaStateMap[state];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const config = bookingStatusMap[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function getAgendaStateLabel(state: AgendaState) {
  return agendaStateMap[state].label;
}

export function getBookingStatusLabel(status: BookingStatus) {
  return bookingStatusMap[status].label;
}
