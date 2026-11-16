"use client";

import { useEffect, useRef } from "react";

export function usePageReturnRefresh(
  refresh: () => void,
  enabled = true,
): void {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    let lastRefreshAt = 0;
    const refreshOnce = () => {
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastRefreshAt < 1_000) return;
      lastRefreshAt = now;
      refreshRef.current();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshOnce();
    };

    window.addEventListener("focus", refreshOnce);
    window.addEventListener("popstate", refreshOnce);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", refreshOnce);

    return () => {
      window.removeEventListener("focus", refreshOnce);
      window.removeEventListener("popstate", refreshOnce);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", refreshOnce);
    };
  }, [enabled]);
}
