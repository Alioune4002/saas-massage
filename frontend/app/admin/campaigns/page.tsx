import { AdminShell } from "@/components/admin/admin-shell";
import { CampaignsDashboard } from "@/components/admin/campaigns-dashboard";
import { requireAdminAccess } from "@/lib/admin-access";

export default async function AdminCampaignsPage() {
  const access = await requireAdminAccess("campaigns");

  return (
    <AdminShell
      title="Campagnes marketing"
      description="Crée des campagnes par ville ou zone, relie-les à l’annuaire et suis les volumes réellement touchés."
      capabilities={access.user.admin_capabilities}
      adminIdentity={{
        email: access.user.email,
        adminRole: access.scope,
        isSuperuser: access.user.is_superuser,
      }}
    >
      <CampaignsDashboard />
    </AdminShell>
  );
}
