import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { MeResponse } from "@/lib/api";

type AdminSection =
  | "dashboard"
  | "ops"
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
    "ops",
    "users",
    "moderation",
    "campaigns",
    "analytics",
    "support",
    "ranking",
    "settings",
  ]),
  ops: new Set(["dashboard", "ops", "users", "campaigns", "analytics", "ranking"]),
  moderator: new Set(["dashboard", "users", "moderation"]),
  support: new Set(["dashboard", "users", "support"]),
};

function getServerApiBase() {
  const configuredBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  return (configuredBase || "http://127.0.0.1:8000/api").replace(/\/$/, "");
}

async function fetchCurrentUserFromBackend(token: string): Promise<MeResponse | null> {
  try {
    const response = await fetch(`${getServerApiBase()}/auth/me/`, {
      method: "GET",
      headers: {
        Authorization: `Token ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as MeResponse;
  } catch {
    return null;
  }
}

export async function requireAdminAccess(section?: AdminSection) {
  const cookieStore = await cookies();
  const token = cookieStore.get("massage_saas_token")?.value || "";

  if (!token) {
    redirect("/login");
  }

  const user = await fetchCurrentUserFromBackend(token);

  if (!user) {
    redirect("/login");
  }

  const isAdminUser = user.role === "admin" || user.is_superuser;
  if (!isAdminUser) {
    redirect("/dashboard");
  }

  const scope = user.is_superuser ? "admin" : user.admin_role || "admin";
  const allowedSections = ADMIN_ROLE_SECTIONS[scope] || ADMIN_ROLE_SECTIONS.admin;

  if (section && !allowedSections.has(section)) {
    redirect("/admin");
  }

  return {
    user,
    scope,
    allowedSections: Array.from(allowedSections),
  };
}

