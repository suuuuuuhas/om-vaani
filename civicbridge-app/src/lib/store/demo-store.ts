import type { CaseRecord, DemoProfile, DraftState } from "@/lib/types";

export interface DemoStore {
  version: 1;
  profile: DemoProfile;
  locale: CaseRecord["locale"];
  draft: DraftState | null;
  cases: CaseRecord[];
}

export const STORAGE_KEY = "civicbridge-demo-v1";
export const DEMO_PROFILE: DemoProfile = {
  id: "demo-citizen",
  displayName: "Aarav (demo citizen)",
  isSynthetic: true
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readRawStore(): DemoStore | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoStore;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.cases)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStore(store: DemoStore): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage may be full or blocked; the prototype keeps working in memory.
  }
}

/** Returns the current store, seeding five synthetic cases on first visit. */
export function ensureStore(seed: () => DemoStore): DemoStore {
  return readRawStore() ?? seed();
}

export function resetToSeed(seed: () => DemoStore): DemoStore {
  const fresh = seed();
  writeStore(fresh);
  return fresh;
}
