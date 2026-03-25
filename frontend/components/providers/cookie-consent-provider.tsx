"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { LegalLinks } from "@/components/legal/legal-links";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SwitchRow } from "@/components/ui/switch-row";
import {
  COOKIE_PREFERENCES_EVENT,
  createCookieConsentState,
  defaultCookieConsentState,
  getCookieConsentSessionKey,
  persistCookieConsent,
  readStoredCookieConsent,
  type CookieConsentPreferences,
  type CookieConsentState,
} from "@/lib/cookie-consent";
import { recordCookieConsent } from "@/lib/api";

type CookieConsentContextValue = {
  consent: CookieConsentState | null;
  enabled: boolean;
  shouldEnable: (category: keyof CookieConsentPreferences) => boolean;
  openPreferences: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

function CookieConsentPanel({
  mode,
  preferences,
  onClose,
  onChange,
  onRejectAll,
  onAcceptAll,
  onSave,
}: {
  mode: "banner" | "preferences";
  preferences: CookieConsentPreferences;
  onClose: () => void;
  onChange: (value: CookieConsentPreferences) => void;
  onRejectAll: () => void;
  onAcceptAll: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto px-3 py-3 sm:px-4 md:px-6 md:py-6">
      <div className="mx-auto flex min-h-full w-full max-w-4xl items-end">
        <Card className="w-full rounded-[2rem] shadow-[0_24px_90px_rgba(0,0,0,0.2)]">
          <div className="flex max-h-[min(42rem,calc(100vh-1.5rem))] flex-col gap-4 overflow-y-auto overscroll-contain pr-1 sm:max-h-[calc(100vh-3rem)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
                Cookies et préférences
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {mode === "banner"
                  ? "Choisir les cookies que vous acceptez"
                  : "Gérer mes cookies"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
                NUADYX n’active que les cookies nécessaires par défaut. Les autres catégories restent désactivées tant que vous ne les avez pas choisies.
              </p>
            </div>
            {mode === "preferences" ? (
              <Button variant="ghost" onClick={onClose}>
                Fermer
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3">
            <Notice tone="info">
              Les cookies nécessaires restent actifs pour la connexion, la sécurité et le bon fonctionnement du service.
            </Notice>
            <SwitchRow
              label="Mesure d’audience"
              description="Mieux comprendre la fréquentation et les usages du site, uniquement si vous l’acceptez."
              checked={preferences.analytics}
              onCheckedChange={(checked) =>
                onChange({ ...preferences, analytics: checked })
              }
            />
            <SwitchRow
              label="Publicité / retargeting"
              description="Pour d’éventuels outils publicitaires et de retargeting, seulement avec votre accord."
              checked={preferences.advertising}
              onCheckedChange={(checked) =>
                onChange({ ...preferences, advertising: checked })
              }
            />
            <SwitchRow
              label="Support / tiers"
              description="Pour certains outils de support ou d’intégration externe nécessitant votre accord."
              checked={preferences.support}
              onCheckedChange={(checked) =>
                onChange({ ...preferences, support: checked })
              }
            />
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <LegalLinks compact />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={onRejectAll}>
                Tout refuser
              </Button>
              <Button variant="secondary" onClick={onSave}>
                Enregistrer mes choix
              </Button>
              <Button onClick={onAcceptAll}>Tout accepter</Button>
            </div>
          </div>
        </div>
        </Card>
      </div>
    </div>
  );
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const enabled =
    (process.env.NEXT_PUBLIC_FEATURE_COOKIE_CONSENT || "true").toLowerCase() ===
    "true";
  const [ready, setReady] = useState(!enabled);
  const [consent, setConsent] = useState<CookieConsentState | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [draft, setDraft] = useState<CookieConsentPreferences>(defaultCookieConsentState);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const storedConsent = readStoredCookieConsent();
      setConsent(storedConsent);
      setDraft(storedConsent || defaultCookieConsentState);
      setShowBanner(!storedConsent);
      setReady(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const openPreferences = () => {
      const storedConsent = readStoredCookieConsent();
      setDraft(storedConsent || defaultCookieConsentState);
      setShowPreferences(true);
      setShowBanner(false);
    };
    window.addEventListener(COOKIE_PREFERENCES_EVENT, openPreferences);
    return () => {
      window.removeEventListener(COOKIE_PREFERENCES_EVENT, openPreferences);
    };
  }, [enabled]);

  async function persistConsent(
    preferences: CookieConsentPreferences,
    source: CookieConsentState["source"]
  ) {
    const nextState = createCookieConsentState(preferences, source);
    setConsent(nextState);
    setDraft(nextState);
    persistCookieConsent(nextState);
    setShowBanner(false);
    setShowPreferences(false);

    try {
      await recordCookieConsent({
        session_key: getCookieConsentSessionKey(),
        source,
        necessary: true,
        analytics: nextState.analytics,
        advertising: nextState.advertising,
        support: nextState.support,
        evidence: {
          version: nextState.version,
          updated_at: nextState.updated_at,
        },
      });
    } catch {
      // On conserve le choix local même si l'enregistrement distant échoue.
    }
  }

  const contextValue = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      enabled,
      shouldEnable: (category) => {
        if (category === "necessary") {
          return true;
        }
        return Boolean(consent?.[category]);
      },
      openPreferences: () => {
        setDraft(consent || defaultCookieConsentState);
        setShowPreferences(true);
        setShowBanner(false);
      },
    }),
    [consent, enabled]
  );

  return (
    <CookieConsentContext.Provider value={contextValue}>
      {children}
      {enabled && ready && showBanner ? (
        <CookieConsentPanel
          mode="banner"
          preferences={draft}
          onClose={() => setShowBanner(false)}
          onChange={setDraft}
          onRejectAll={() =>
            void persistConsent(
              { necessary: true, analytics: false, advertising: false, support: false },
              "banner"
            )
          }
          onAcceptAll={() =>
            void persistConsent(
              { necessary: true, analytics: true, advertising: true, support: true },
              "banner"
            )
          }
          onSave={() => void persistConsent(draft, "banner")}
        />
      ) : null}
      {enabled && ready && showPreferences ? (
        <CookieConsentPanel
          mode="preferences"
          preferences={draft}
          onClose={() => setShowPreferences(false)}
          onChange={setDraft}
          onRejectAll={() =>
            void persistConsent(
              { necessary: true, analytics: false, advertising: false, support: false },
              "preferences"
            )
          }
          onAcceptAll={() =>
            void persistConsent(
              { necessary: true, analytics: true, advertising: true, support: true },
              "preferences"
            )
          }
          onSave={() => void persistConsent(draft, "preferences")}
        />
      ) : null}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error("useCookieConsent doit être utilisé dans CookieConsentProvider.");
  }
  return context;
}
