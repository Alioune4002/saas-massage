import { AdminShell } from "@/components/admin/admin-shell";
import { DashboardGlobal } from "@/components/admin/dashboard-global";
import { requireAdminAccess } from "@/lib/admin-access";

export default async function AdminDashboardPage() {
  const access = await requireAdminAccess("dashboard");

  return (
    <AdminShell
      title="Dashboard global"
      description="Vision instantanée de NUADYX : croissance praticiens, réservations, revenus capturés, incidents ouverts et villes qui accélèrent."
      capabilities={access.user.admin_capabilities}
      adminIdentity={{
        email: access.user.email,
        adminRole: access.scope,
        isSuperuser: access.user.is_superuser,
      }}
    >
      <DashboardGlobal />
    </AdminShell>
  );
}
