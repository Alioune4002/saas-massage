import { AdminShell } from "@/components/admin/admin-shell";
import { ModerationDashboard } from "@/components/admin/moderation-dashboard";
import { requireAdminAccess } from "@/lib/admin-access";

export default async function AdminModerationPage() {
  await requireAdminAccess("moderation");

  return (
    <AdminShell
      title="Modération / signalements / sanctions"
      description="Traite les signalements, surveille les comptes à risque, applique des décisions documentées et garde une trace claire des restrictions."
    >
      <ModerationDashboard />
    </AdminShell>
  );
}
