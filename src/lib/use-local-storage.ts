"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Subscribe to an external browser store without a synchronous hydration effect.
// Retains existing keys; actor-scoped clinical drafts are a separate migration.
export function useLocalStorageState<T>(key: string, fallback: T) {
  const subscribe = useCallback((notify: () => void) => {
    const listener = (event: StorageEvent) => { if (event.key === key || event.key === null) notify(); };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [key]);
  const snapshot = useCallback(() => {
    try { return localStorage.getItem(key); } catch { return null; }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const value = useMemo((): T => {
    try { return raw === null ? fallback : JSON.parse(raw) as T; } catch { return fallback; }
  }, [raw, fallback]);
  const setValue = useCallback((next: T | ((previous: T) => T)) => {
    let previous = fallback;
    try { const stored = localStorage.getItem(key); if (stored !== null) previous = JSON.parse(stored) as T; } catch { /* use fallback */ }
    const value = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new StorageEvent("storage", { key }));
  }, [key, fallback]);
  return [value, setValue] as const;
}
