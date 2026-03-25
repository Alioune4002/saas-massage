import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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

  return <OpsDashboard />;
}
