import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type AdminSection =
  | "dashboard"
  | "users"
  | "moderation"
  | "campaigns"
  | "analytics"
  | "support"
  | "ranking"
  | "settings";

const ADMIN_ROLE_SECTIONS: Record<string, Set<AdminSection>> = {
  admin: new Set([
    "dashboard",
    "users",
    "moderation",
    "campaigns",
    "analytics",
    "support",
    "ranking",
    "settings",
  ]),
  ops: new Set(["dashboard", "users", "campaigns", "analytics", "ranking"]),
  moderator: new Set(["dashboard", "users", "moderation"]),
  support: new Set(["dashboard", "users", "support"]),
};

export async function requireAdminAccess(section?: AdminSection) {
  const cookieStore = await cookies();
  const role = cookieStore.get("massage_saas_role")?.value || "";
  const adminRole = cookieStore.get("massage_saas_admin_role")?.value || "admin";

  if (!role) {
    redirect("/login");
  }

  if (role !== "admin") {
    redirect("/dashboard");
  }

  if (!section) {
    return { role, adminRole };
  }

  const allowedSections = ADMIN_ROLE_SECTIONS[adminRole] || ADMIN_ROLE_SECTIONS.admin;
  if (!allowedSections.has(section)) {
    redirect("/admin");
  }

  return { role, adminRole };
}

