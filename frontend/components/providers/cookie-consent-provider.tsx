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
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_PREFERENCES_EVENT,
  createCookieConsentState,
  defaultCookieConsentState,
  getCookieConsentSessionKey,
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
    <div className="fixed inset-x-0 bottom-0 z-[80] px-3 pb-3 md:px-6 md:pb-6">
      <Card className="mx-auto max-w-4xl rounded-[2rem] shadow-[0_24px_90px_rgba(0,0,0,0.2)]">
        <div className="flex flex-col gap-4">
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
                NUADYX active uniquement les cookies nécessaires par défaut. Les autres catégories restent désactivées tant que vous ne les avez pas acceptées.
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
              Les cookies strictement nécessaires restent actifs pour assurer l’authentification, la sécurité et le bon fonctionnement du service.
            </Notice>
            <SwitchRow
              label="Mesure d’audience"
              description="Comprendre la fréquentation et la performance du service, sans activer cette catégorie avant votre accord."
              checked={preferences.analytics}
              onCheckedChange={(checked) =>
                onChange({ ...preferences, analytics: checked })
              }
            />
            <SwitchRow
              label="Publicité / retargeting"
              description="Réservé aux pixels publicitaires et outils de retargeting si ces services sont activés plus tard."
              checked={preferences.advertising}
              onCheckedChange={(checked) =>
                onChange({ ...preferences, advertising: checked })
              }
            />
            <SwitchRow
              label="Support / tiers"
              description="Pour des services de support, chat ou intégrations tierces nécessitant votre accord."
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
  );
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const enabled =
    (process.env.NEXT_PUBLIC_FEATURE_COOKIE_CONSENT || "true").toLowerCase() ===
    "true";
  const [consent, setConsent] = useState<CookieConsentState | null>(() => {
    if (!enabled) {
      return null;
    }
    return readStoredCookieConsent();
  });
  const [showBanner, setShowBanner] = useState(() => enabled && !readStoredCookieConsent());
  const [showPreferences, setShowPreferences] = useState(false);
  const [draft, setDraft] = useState<CookieConsentPreferences>(
    () => readStoredCookieConsent() || defaultCookieConsentState
  );

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
    window.localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      JSON.stringify(nextState)
    );
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
      // La preuve locale reste prioritaire pour ne pas bloquer l'UX.
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
      {enabled && showBanner ? (
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
      {enabled && showPreferences ? (
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
