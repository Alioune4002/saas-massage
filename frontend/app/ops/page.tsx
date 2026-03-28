import { AdminShell } from "@/components/admin/admin-shell";
import { OpsDashboard } from "@/components/directory/ops-dashboard";
import { requireAdminAccess } from "@/lib/admin-access";

export default async function OpsPage() {
  const access = await requireAdminAccess("ops");

  return (
    <AdminShell
      title="Cockpit business / acquisition / annuaire"
      description="Pilote la croissance locale, les imports, les revendications, les campagnes, les suppressions et la couverture ville par ville."
      capabilities={access.user.admin_capabilities}
      adminIdentity={{
        email: access.user.email,
        adminRole: access.scope,
        isSuperuser: access.user.is_superuser,
      }}
    >
      <OpsDashboard />
    </AdminShell>
  );
}
