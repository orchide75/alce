/**
 * Persistență locală automată (localStorage). Funcționează defensiv: dacă
 * stocarea nu este disponibilă (mod privat, blocată), aplicația rulează
 * normal, doar fără salvare automată – iar utilizatorul este informat.
 */
import { createDefaultState } from '../domain/defaults';
import type { AppState } from '../domain/types';
import { buildExport, parseImport } from './exportImport';

const KEY = 'ecp.state';
const META_KEY = 'ecp.meta';

export interface StorageMeta {
  lastSavedAt: string | null;
  available: boolean;
  loadError: string | null;
}

function storage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__ecp_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function loadState(): { state: AppState; meta: StorageMeta } {
  const s = storage();
  if (!s) return { state: createDefaultState(), meta: { lastSavedAt: null, available: false, loadError: null } };
  let lastSavedAt: string | null = null;
  try {
    lastSavedAt = JSON.parse(s.getItem(META_KEY) ?? 'null')?.lastSavedAt ?? null;
  } catch {
    /* ignorăm meta corupt */
  }
  const raw = s.getItem(KEY);
  if (!raw) return { state: createDefaultState(), meta: { lastSavedAt, available: true, loadError: null } };
  const res = parseImport(raw);
  if (res.ok) return { state: res.state, meta: { lastSavedAt, available: true, loadError: null } };
  // Date locale corupte: le păstrăm într-o cheie separată, nu le ștergem.
  const backupKey = `${KEY}.corupt.${Date.now()}`;
  try {
    s.setItem(backupKey, raw);
  } catch {
    /* spațiu insuficient – ignorăm */
  }
  return {
    state: createDefaultState(),
    meta: {
      lastSavedAt,
      available: true,
      loadError: `Datele salvate local nu au putut fi citite (${res.errors[0]}). O copie a fost păstrată în „${backupKey}”. Poți importa un backup JSON.`,
    },
  };
}

export function saveState(state: AppState): string | null {
  const s = storage();
  if (!s) return null;
  try {
    const now = new Date().toISOString();
    s.setItem(KEY, JSON.stringify(buildExport(state)));
    s.setItem(META_KEY, JSON.stringify({ lastSavedAt: now }));
    return now;
  } catch {
    return null;
  }
}

export function clearStoredState(): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(KEY);
    s.removeItem(META_KEY);
  } catch {
    /* ignorăm */
  }
}
