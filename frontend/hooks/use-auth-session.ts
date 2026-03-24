"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ApiUnavailableError,
  getMe,
  type MeResponse,
} from "@/lib/api";
import { clearSession, getStoredUser, setStoredUser } from "@/lib/auth";

export function useAuthSession() {
  const router = useRouter();
  const [user, setUser] = useState<MeResponse | null>(getStoredUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const me = await getMe();
        if (!active) return;

        setStoredUser(me);
        setUser(me);
        setError("");
      } catch (err) {
        if (!active) return;

        const cachedUser = getStoredUser();

        if (err instanceof ApiUnavailableError) {
          if (cachedUser) {
            setUser(cachedUser);
            setError(
              "Le service est temporairement indisponible. Les informations déjà chargées restent visibles, mais les actions sécurisées sont mises en pause."
            );
            return;
          }

          clearSession();
          setError(
            "Le service est temporairement indisponible. Impossible de vérifier la session pour le moment."
          );
          router.replace("/login?service=unavailable");
          return;
        }

        clearSession();
        setError(err instanceof Error ? err.message : "Session invalide.");
        router.replace("/login");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  function logout() {
    clearSession();
    router.replace("/login");
  }

  return {
    user,
    loading,
    error,
    logout,
  };
}
