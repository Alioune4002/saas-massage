import { AdminShell } from "@/components/admin/admin-shell";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { requireAdminAccess } from "@/lib/admin-access";

export default async function AdminAnalyticsPage() {
  const access = await requireAdminAccess("analytics");

  return (
    <AdminShell
      title="Analytics / KPI / conversions"
      description="Vue d’ensemble des volumes réellement disponibles : inscriptions, profils publics, claims, réservations, villes pilotées et signaux de croissance locale."
      capabilities={access.user.admin_capabilities}
      adminIdentity={{
        email: access.user.email,
        adminRole: access.scope,
        isSuperuser: access.user.is_superuser,
      }}
    >
      <AnalyticsDashboard />
    </AdminShell>
  );
}
