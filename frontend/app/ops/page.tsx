import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { OpsDashboard } from "@/components/directory/ops-dashboard";

export default async function OpsPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("massage_saas_role")?.value;

  if (!role) {
    redirect("/login");
  }

  if (role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <AdminShell
      title="Cockpit business / acquisition / annuaire"
      description="Pilote la croissance locale, les imports, les revendications, les campagnes, les suppressions et la couverture ville par ville."
    >
      <OpsDashboard />
    </AdminShell>
  );
}
