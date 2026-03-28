"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { trackPageView } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

const STORAGE_KEY = "nuadyx-pageview-session";

function getSessionKey() {
  if (typeof window === "undefined") {
    return "";
  }
  const current = window.sessionStorage.getItem(STORAGE_KEY);
  if (current) {
    return current;
  }
  const nextValue =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `pv-${Date.now()}`;
  window.sessionStorage.setItem(STORAGE_KEY, nextValue);
  return nextValue;
}

function inferPageGroup(pathname: string) {
  if (pathname === "/") return "landing_practitioners";
  if (pathname.startsWith("/trouver-un-praticien")) return "directory_entry";
  if (pathname.startsWith("/annuaire")) return "directory";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/ops")) return "ops";
  if (pathname.startsWith("/dashboard")) return "practitioner_dashboard";
  if (pathname.startsWith("/bookings")) return "practitioner_bookings";
  if (pathname.startsWith("/payments")) return "practitioner_payments";
  return "other";
}

function inferCitySlug(pathname: string) {
  if (pathname.startsWith("/annuaire/")) {
    return pathname.replace("/annuaire/", "").split("/")[0] || "";
  }
  return "";
}

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastKeyRef = useRef("");

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const key = `${pathname}?${searchParams.toString()}`;
    if (lastKeyRef.current === key) {
      return;
    }
    lastKeyRef.current = key;

    const me = getStoredUser();
    void trackPageView({
      path: pathname,
      page_group: inferPageGroup(pathname),
      city_slug: inferCitySlug(pathname),
      referrer: typeof document !== "undefined" ? document.referrer || "" : "",
      session_key: getSessionKey(),
      metadata: me?.role ? { role: me.role } : {},
    }).catch(() => {
      // Silent on purpose: tracking must never block UI.
    });
  }, [pathname, searchParams]);

  return null;
}

