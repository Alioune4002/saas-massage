"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  API_STATUS_EVENT,
  getStoredApiAvailabilityState,
  type ApiAvailabilityState,
} from "@/lib/api";

type BackendStatusContextValue = {
  backendUnavailable: boolean;
  reason: string;
  checkedAt: string | null;
};

const BackendStatusContext = createContext<BackendStatusContextValue | null>(
  null
);

function getInitialState(): ApiAvailabilityState {
  const stored = getStoredApiAvailabilityState();
  if (stored) {
    return stored;
  }

  return {
    available: true,
    checkedAt: "",
    reason: "",
  };
}

export function BackendStatusProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [status, setStatus] = useState<ApiAvailabilityState>(getInitialState);

  useEffect(() => {
    function handleStatus(event: Event) {
      const customEvent = event as CustomEvent<ApiAvailabilityState>;
      if (!customEvent.detail) {
        return;
      }

      setStatus(customEvent.detail);
    }

    function handleOffline() {
      setStatus({
        available: false,
        checkedAt: new Date().toISOString(),
        reason:
          "Connexion réseau indisponible. Les actions qui demandent le serveur sont temporairement suspendues.",
      });
    }

    function handleOnline() {
      setStatus((current) => ({
        ...current,
        reason: current.available
          ? current.reason
          : "Connexion rétablie. Le service revient progressivement.",
      }));
    }

    window.addEventListener(API_STATUS_EVENT, handleStatus as EventListener);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener(
        API_STATUS_EVENT,
        handleStatus as EventListener
      );
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const value = useMemo<BackendStatusContextValue>(
    () => ({
      backendUnavailable: !status.available,
      reason: status.reason || "",
      checkedAt: status.checkedAt || null,
    }),
    [status]
  );

  return (
    <BackendStatusContext.Provider value={value}>
      {children}
    </BackendStatusContext.Provider>
  );
}

export function useBackendStatus() {
  const context = useContext(BackendStatusContext);

  if (!context) {
    throw new Error(
      "useBackendStatus must be used within BackendStatusProvider."
    );
  }

  return context;
}
