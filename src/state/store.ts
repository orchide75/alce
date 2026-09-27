/**
 * Store global minimal (useSyncExternalStore) cu salvare automată în
 * localStorage. Toate modificările trec prin `update`.
 */
import { useSyncExternalStore } from 'react';
import { createDefaultState } from '../domain/defaults';
import type { AppState } from '../domain/types';
import { clearStoredState, loadState, saveState, type StorageMeta } from '../persistence/storage';

export interface StoreSnapshot {
  state: AppState;
  meta: StorageMeta & { lastChangeAt: string | null };
}

type Listener = () => void;

const CHANGE_KEY = 'ecp.lastChangeAt';

function readLastChange(): string | null {
  try {
    return window.localStorage.getItem(CHANGE_KEY);
  } catch {
    return null;
  }
}
function writeLastChange(v: string) {
  try {
    window.localStorage.setItem(CHANGE_KEY, v);
  } catch {
    /* ignorăm */
  }
}

const initial = loadState();
let snapshot: StoreSnapshot = {
  state: initial.state,
  meta: { ...initial.meta, lastChangeAt: readLastChange() },
};
const listeners = new Set<Listener>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  for (const l of listeners) l();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 300);
}

export function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const savedAt = saveState(snapshot.state);
  snapshot = { ...snapshot, meta: { ...snapshot.meta, lastSavedAt: savedAt ?? snapshot.meta.lastSavedAt } };
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (saveTimer) flushSave();
  });
}

/**
 * Aplică o modificare. `isDataChange=false` pentru modificări de preferințe UI
 * care nu trebuie să marcheze backup-ul ca neactualizat.
 */
export function update(fn: (s: AppState) => AppState, isDataChange = true) {
  const next = fn(snapshot.state);
  if (next === snapshot.state) return;
  const now = new Date().toISOString();
  snapshot = {
    state: next,
    meta: { ...snapshot.meta, lastChangeAt: isDataChange ? now : snapshot.meta.lastChangeAt },
  };
  if (isDataChange) writeLastChange(now);
  emit();
  scheduleSave();
}

export function replaceState(state: AppState) {
  update(() => state);
  flushSave();
}

export function resetApplication() {
  clearStoredState();
  const now = new Date().toISOString();
  snapshot = { state: createDefaultState(), meta: { ...snapshot.meta, loadError: null, lastChangeAt: now } };
  writeLastChange(now);
  emit();
  flushSave();
}

export function dismissLoadError() {
  snapshot = { ...snapshot, meta: { ...snapshot.meta, loadError: null } };
  emit();
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore(): StoreSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot);
}

export function useAppState(): AppState {
  return useStore().state;
}

export function getState(): AppState {
  return snapshot.state;
}
