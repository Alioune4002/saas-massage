import { AdminShell } from "@/components/admin/admin-shell";
import { SupportDashboard } from "@/components/admin/support-dashboard";

export default function AdminSupportPage() {
  return (
    <AdminShell
      title="Support / messages plateforme / annonces"
      description="Retrouve les utilisateurs, envoie des messages in-app, prépare des annonces visibles dans l’app et garde un historique clair des communications plateforme."
    >
      <SupportDashboard />
    </AdminShell>
  );
}
