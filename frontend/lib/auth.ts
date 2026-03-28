import {
  clearStoredToken,
  getMe,
  setStoredToken,
  type MeResponse,
} from "./api";

const USER_STORAGE_KEY = "massage_saas_me";

export function getStoredUser(): MeResponse | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as MeResponse;
  } catch {
    return null;
  }
}

export function setStoredUser(user: MeResponse) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  document.cookie = `massage_saas_role=${encodeURIComponent(user.role)}; Path=/; Max-Age=2592000; SameSite=Lax`;
  document.cookie = `massage_saas_admin_role=${encodeURIComponent(user.admin_role || "")}; Path=/; Max-Age=2592000; SameSite=Lax`;
  document.cookie = `massage_saas_is_superuser=${user.is_superuser ? "1" : "0"}; Path=/; Max-Age=2592000; SameSite=Lax`;
}

export function clearSession() {
  clearStoredToken();
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(USER_STORAGE_KEY);
    document.cookie = "massage_saas_role=; Path=/; Max-Age=0; SameSite=Lax";
    document.cookie = "massage_saas_admin_role=; Path=/; Max-Age=0; SameSite=Lax";
    document.cookie = "massage_saas_is_superuser=; Path=/; Max-Age=0; SameSite=Lax";
  }
}

export async function hydrateSession(token: string) {
  setStoredToken(token);
  const me = await getMe();
  setStoredUser(me);
  return me;
}

export function getAuthenticatedHomePath(user: MeResponse | null) {
  if (!user) {
    return "/login";
  }

  if (user.role === "admin" || user.is_superuser) {
    return "/admin";
  }

  return user.onboarding_completed ? "/dashboard" : "/bienvenue";
}
