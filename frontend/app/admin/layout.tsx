import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const role = cookieStore.get("massage_saas_role")?.value;

  if (!role) {
    redirect("/login");
  }

  if (role !== "admin") {
    redirect("/dashboard");
  }

  return children;
}
