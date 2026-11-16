"use client";

import { useEffect, useState } from "react";

export type AppLanguage = "ar" | "en";

const LANGUAGE_STORAGE_KEY = "daftaro-language";

export function useAppLanguage() {
  const [language, setLanguage] = useState<AppLanguage>("ar");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === "ar" || saved === "en") setLanguage(saved);
    } catch {
      // Continue with the default language if storage is unavailable.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Language selection still works for this page if storage is unavailable.
    }
  }, [language, ready]);

  return [language, setLanguage] as const;
}
