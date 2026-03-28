import { AdminShell } from "@/components/admin/admin-shell";
import { UsersDashboard } from "@/components/admin/users-dashboard";
import { requireAdminAccess } from "@/lib/admin-access";

export default async function AdminUsersPage() {
  await requireAdminAccess("users");

  return (
    <AdminShell
      title="Utilisateurs & praticiens"
      description="Table de pilotage des comptes, statuts, profils publics, historique d’activité, incidents et volumes encaissés."
    >
      <UsersDashboard />
    </AdminShell>
  );
}

