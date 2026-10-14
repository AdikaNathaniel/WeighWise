'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { ALL_RULES, RuleId } from './nelsonRules';

// Which Nelson rules are switched on is a per-browser preference, shared by
// every chart in the app.
const STORAGE_KEY = 'weighwise.enabledRules';
const DEFAULT_VALUE = ALL_RULES.join(',');

const listeners = new Set<() => void>();
let cached: string | null = null;

function read(): string {
  if (cached !== null) return cached;
  try {
    cached = window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_VALUE;
  } catch {
    cached = DEFAULT_VALUE;
  }
  return cached;
}

function write(value: string) {
  cached = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage unavailable (private mode etc.) — keep the in-memory value.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function parse(value: string): RuleId[] {
  const ids = value.split(',').map(Number);
  return ALL_RULES.filter((r) => ids.includes(r));
}

export function useEnabledRules(): [RuleId[], (rule: RuleId, on: boolean) => void] {
  const value = useSyncExternalStore(subscribe, read, () => DEFAULT_VALUE);

  const setRule = useCallback((rule: RuleId, on: boolean) => {
    const current = new Set(parse(read()));
    if (on) current.add(rule);
    else current.delete(rule);
    write(ALL_RULES.filter((r) => current.has(r)).join(','));
  }, []);

  return [parse(value), setRule];
}
