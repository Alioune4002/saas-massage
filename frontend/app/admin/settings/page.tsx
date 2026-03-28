import { AdminShell } from "@/components/admin/admin-shell";
import { SettingsDashboard } from "@/components/admin/settings-dashboard";
import { requireAdminAccess } from "@/lib/admin-access";

export default async function AdminSettingsPage() {
  const access = await requireAdminAccess("settings");

  return (
    <AdminShell
      title="Paramètres plateforme"
      description="Contrôle l’état de la plateforme, les garde-fous de paiement, les defaults métier et les signaux de sécurité."
      capabilities={access.user.admin_capabilities}
      adminIdentity={{
        email: access.user.email,
        adminRole: access.scope,
        isSuperuser: access.user.is_superuser,
      }}
    >
      <SettingsDashboard />
    </AdminShell>
  );
}
