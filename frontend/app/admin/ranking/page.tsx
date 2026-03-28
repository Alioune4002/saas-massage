import { AdminShell } from "@/components/admin/admin-shell";
import { RankingDashboard } from "@/components/admin/ranking-dashboard";
import { requireAdminAccess } from "@/lib/admin-access";

export default async function AdminRankingPage() {
  await requireAdminAccess("ranking");

  return (
    <AdminShell
      title="Classement & visibilité"
      description="Comprends les signaux de visibilité réels, les scores de complétude et ajuste la mise en avant interne si nécessaire."
    >
      <RankingDashboard />
    </AdminShell>
  );
}

