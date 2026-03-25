export type CookieConsentPreferences = {
  necessary: boolean;
  analytics: boolean;
  advertising: boolean;
  support: boolean;
};

export type CookieConsentState = CookieConsentPreferences & {
  version: string;
  source: "banner" | "preferences" | "support";
  updated_at: string;
};

export const COOKIE_CONSENT_STORAGE_KEY = "nuadyx-cookie-consent";
export const COOKIE_CONSENT_SESSION_KEY = "nuadyx-cookie-consent-session";
export const COOKIE_PREFERENCES_EVENT = "nuadyx:open-cookie-preferences";
export const COOKIE_CONSENT_VERSION =
  process.env.NEXT_PUBLIC_COOKIE_CONSENT_VERSION || "2026-03-25";

export const defaultCookieConsentState: CookieConsentState = {
  version: COOKIE_CONSENT_VERSION,
  source: "banner",
  updated_at: "",
  necessary: true,
  analytics: false,
  advertising: false,
  support: false,
};

export function createCookieConsentState(
  preferences: CookieConsentPreferences,
  source: CookieConsentState["source"]
): CookieConsentState {
  return {
    version: COOKIE_CONSENT_VERSION,
    source,
    updated_at: new Date().toISOString(),
    necessary: true,
    analytics: preferences.analytics,
    advertising: preferences.advertising,
    support: preferences.support,
  };
}

export function readStoredCookieConsent(): CookieConsentState | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as CookieConsentState;
    if (parsed.version !== COOKIE_CONSENT_VERSION) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getCookieConsentSessionKey() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(COOKIE_CONSENT_SESSION_KEY);
  if (existing) {
    return existing;
  }

  const generated =
    typeof window.crypto !== "undefined" && "randomUUID" in window.crypto
      ? window.crypto.randomUUID()
      : `nuadyx-${Date.now()}`;
  window.localStorage.setItem(COOKIE_CONSENT_SESSION_KEY, generated);
  return generated;
}
