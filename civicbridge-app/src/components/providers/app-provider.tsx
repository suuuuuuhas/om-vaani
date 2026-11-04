"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { CaseRecord, DraftState, Locale } from "@/lib/types";
import {
  ensureStore,
  readRawStore,
  writeStore,
  type DemoStore
} from "@/lib/store/demo-store";
import { buildSeedStore } from "@/data/seed-cases";
import { getDictionary, type Dictionary } from "@/lib/i18n";

interface AppContextValue {
  /** Null until mounted - server and first client render stay identical. */
  store: DemoStore | null;
  locale: Locale;
  dict: Dictionary;
  setLocale: (locale: Locale) => void;
  saveDraft: (draft: DraftState) => void;
  clearDraft: () => void;
  addCase: (record: CaseRecord) => void;
  updateCase: (id: string, updater: (c: CaseRecord) => CaseRecord) => void;
  resetDemo: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<DemoStore | null>(null);

  useEffect(() => {
    // Seed-and-persist on first visit so the versioned key always exists.
    const existing = readRawStore();
    if (existing) {
      setStore(existing);
      return;
    }
    const fresh = buildSeedStore();
    writeStore(fresh);
    setStore(fresh);
  }, []);

  const mutate = useCallback((fn: (s: DemoStore) => DemoStore) => {
    setStore((prev) => {
      const base =
        prev ??
        (typeof window !== "undefined"
          ? ensureStore(buildSeedStore)
          : buildSeedStore());
      const next = fn(base);
      writeStore(next);
      return next;
    });
  }, []);

  const setLocale = useCallback(
    (locale: Locale) => {
      mutate((s) => ({ ...s, locale }));
      if (typeof document !== "undefined") {
        document.documentElement.lang = locale === "en" ? "en" : locale;
      }
    },
    [mutate]
  );

  useEffect(() => {
    if (store && typeof document !== "undefined") {
      document.documentElement.lang = store.locale;
    }
  }, [store]);

  const value = useMemo<AppContextValue>(
    () => ({
      store,
      locale: store?.locale ?? "en",
      dict: getDictionary(store?.locale ?? "en"),
      setLocale,
      saveDraft: (draft) => mutate((s) => ({ ...s, draft })),
      clearDraft: () => mutate((s) => ({ ...s, draft: null })),
      addCase: (record) =>
        mutate((s) => ({
          ...s,
          cases: [record, ...s.cases],
          draft: null
        })),
      updateCase: (id, updater) =>
        mutate((s) => ({
          ...s,
          cases: s.cases.map((c) =>
            c.id === id ? { ...updater(c), updatedAt: new Date().toISOString() } : c
          )
        })),
      resetDemo: () => {
        const fresh = buildSeedStore();
        fresh.locale = store?.locale ?? fresh.locale;
        writeStore(fresh);
        setStore(fresh);
      }
    }),
    [store, mutate, setLocale]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

/** Convenience for pages that need a seeded store and treat missing as loading. */
export function useSeededStore(): DemoStore | null {
  const { store } = useApp();
  useEffect(() => {
    if (!store && readRawStore() === null && typeof window !== "undefined") {
      // First ever visit happens through AppProvider's mount effect; nothing to do here.
    }
  }, [store]);
  return store;
}
