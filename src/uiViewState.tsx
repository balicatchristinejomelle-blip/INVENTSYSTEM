import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useApp } from './store';

export const VIEW_STATE_PREFIX = 'hpai:ui-view:v1:';
const ViewScope = createContext<string | null>(null);
export function ViewStateScope({ children }: { children: React.ReactNode }) {
  const { currentUser, currentPage } = useApp();
  const scope = currentUser ? `${currentUser.employeeId}:${currentUser.role}:${currentPage}` : null;
  return <ViewScope.Provider value={scope}>{children}</ViewScope.Provider>;
}
export function validViewValue(value: unknown, fallback: unknown): boolean {
  if (typeof fallback === 'string') return typeof value === 'string' && value.length <= 1000;
  if (typeof fallback === 'boolean') return typeof value === 'boolean';
  if (typeof fallback === 'number') return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
  if (!fallback || typeof fallback !== 'object' || Array.isArray(fallback)) return false;
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => Object.prototype.hasOwnProperty.call(fallback, key))
    && Object.entries(fallback).every(([key, item]) => validViewValue((value as Record<string, unknown>)[key], item));
}
export function readViewValue<T>(storage: Pick<Storage, 'getItem'> | undefined, key: string | null, fallback: T): T {
  if (!storage || !key) return fallback;
  try { const parsed: unknown = JSON.parse(storage.getItem(key) || 'null'); return validViewValue(parsed, fallback) ? parsed as T : fallback; }
  catch { return fallback; }
}
/** View preferences only: never persists drafts, selected records, permissions or inventory. */
export function useViewState<T>(name: string, initial: T | (() => T), allowed?: readonly T[]): [T, React.Dispatch<React.SetStateAction<T>>] {
  const scope = useContext(ViewScope);
  const key = scope ? VIEW_STATE_PREFIX + scope + ':' + name : null;
  const [value, setValue] = useState<T>(() => {
    const fallback = typeof initial === 'function' ? (initial as () => T)() : initial;
    try {
      const restored = readViewValue(typeof window === 'undefined' ? undefined : window.sessionStorage, key, fallback);
      return allowed && !allowed.includes(restored) ? (allowed.includes(fallback) ? fallback : allowed[0] ?? fallback) : restored;
    }
    catch { return fallback; }
  });
  const latest = useRef(value);
  latest.current = value;
  const change = useCallback<React.Dispatch<React.SetStateAction<T>>>(next => {
    const resolved = typeof next === 'function' ? (next as (current: T) => T)(latest.current) : next;
    latest.current = resolved; setValue(resolved);
    if (key) try { window.sessionStorage.setItem(key, JSON.stringify(resolved)); } catch { /* In-memory UI remains usable. */ }
  }, [key]);
  return [value, change];
}
/** Reset pagination on actual filter changes, not merely on returning to a mounted list. */
export function useFilterChangeEffect(effect: React.EffectCallback, dependencies: React.DependencyList) {
  const previous = useRef(dependencies);
  useEffect(() => {
    if (dependencies.every((value, index) => Object.is(value, previous.current[index])) && dependencies.length === previous.current.length) return;
    previous.current = dependencies;
    return effect();
  }, dependencies);
}
