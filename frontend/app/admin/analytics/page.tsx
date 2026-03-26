import { AdminShell } from "@/components/admin/admin-shell";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";

export default function AdminAnalyticsPage() {
  return (
    <AdminShell
      title="Analytics / KPI / conversions"
      description="Vue d’ensemble des volumes réellement disponibles : inscriptions, profils publics, claims, réservations, villes pilotées et signaux de croissance locale."
    >
      <AnalyticsDashboard />
    </AdminShell>
  );
}
