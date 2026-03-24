"use client";

import { Notice } from "@/components/ui/notice";
import { useBackendStatus } from "@/components/providers/backend-status-provider";

export function GlobalServiceBanner() {
  const { backendUnavailable, reason } = useBackendStatus();

  if (!backendUnavailable) {
    return null;
  }

  return (
    <div className="sticky top-0 z-40 px-3 pt-3 md:px-5">
      <div className="mx-auto max-w-7xl">
        <Notice tone="error" className="rounded-[1.35rem]">
          <div className="space-y-1">
            <p className="font-medium">Service temporairement indisponible</p>
            <p className="leading-6 opacity-90">
              {reason ||
                "Les pages déjà chargées restent consultables, mais la connexion, les réservations, les règlements et les autres actions sécurisées sont momentanément suspendus."}
            </p>
          </div>
        </Notice>
      </div>
    </div>
  );
}
