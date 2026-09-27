import { APP_VERSION, SCHEMA_VERSION } from '../domain/defaults';
import type { AppState } from '../domain/types';
import { migrate } from './migrations';
import { formatIssues, stateSchema } from './schema';

export const APP_ID = 'ecommerce-calculator-profit';

export interface ExportFile {
  app: string;
  version: string;
  schemaVersion: number;
  exportedAt: string;
  companySettings: AppState['companySettings'];
  taxSettings: AppState['taxSettings'];
  fx: AppState['fx'];
  fixedCosts: AppState['fixedCosts'];
  variableCosts: AppState['variableCosts'];
  returnSettings: AppState['returnSettings'];
  allocation: AppState['allocation'];
  products: AppState['products'];
  scenarios: AppState['scenarios'];
  preferences: AppState['preferences'];
}

export function buildExport(state: AppState, now = new Date()): ExportFile {
  return {
    app: APP_ID,
    version: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    companySettings: state.companySettings,
    taxSettings: state.taxSettings,
    fx: state.fx,
    fixedCosts: state.fixedCosts,
    variableCosts: state.variableCosts,
    returnSettings: state.returnSettings,
    allocation: state.allocation,
    products: state.products,
    scenarios: state.scenarios,
    preferences: state.preferences,
  };
}

export function exportFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `calculator-profit-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}.json`;
}

export type ImportResult =
  | {
      ok: true;
      state: AppState;
      meta: { version: string | null; schemaVersion: number; migratedFrom: number; exportedAt: string | null };
      summary: { products: number; scenarios: number; fixedCosts: number };
    }
  | { ok: false; errors: string[] };

/**
 * Validează complet un text JSON. NU modifică nimic – apelantul decide dacă
 * aplică rezultatul. În caz de eroare, datele existente rămân neatinse.
 */
export function parseImport(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Fișierul nu este JSON valid: ${(e as Error).message}`] };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['Structură invalidă: fișierul trebuie să conțină un obiect JSON.'] };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.app !== undefined && obj.app !== APP_ID) {
    return { ok: false, errors: [`Fișierul provine din altă aplicație („${String(obj.app)}”).`] };
  }
  if (typeof obj.schemaVersion !== 'number') {
    return { ok: false, errors: ['Lipsește câmpul „schemaVersion” – fișierul nu pare a fi un backup al acestei aplicații.'] };
  }
  if (obj.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`Fișierul are schema v${obj.schemaVersion}, dar aplicația suportă maxim v${SCHEMA_VERSION}. Actualizează aplicația.`],
    };
  }
  const required = ['taxSettings', 'fixedCosts', 'variableCosts', 'returnSettings'];
  const missing = required.filter((k) => !(k in obj));
  if (missing.length) return { ok: false, errors: [`Secțiuni lipsă: ${missing.join(', ')}.`] };

  let migrated;
  try {
    migrated = migrate(obj);
  } catch (e) {
    return { ok: false, errors: [(e as Error).message] };
  }
  const { app: _a, version: _v, exportedAt: _e, ...rest } = migrated.data;
  const parsed = stateSchema.safeParse(rest);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const state = parsed.data as unknown as AppState;
  const ids = new Set<string>();
  for (const p of state.products) {
    if (ids.has(p.id)) return { ok: false, errors: [`ID de produs duplicat: ${p.id}`] };
    ids.add(p.id);
  }
  // Scenariile care referă produse inexistente sunt eliminate.
  state.scenarios = state.scenarios.filter((s) => ids.has(s.productId));
  state.schemaVersion = SCHEMA_VERSION;

  return {
    ok: true,
    state,
    meta: {
      version: typeof obj.version === 'string' ? obj.version : null,
      schemaVersion: obj.schemaVersion,
      migratedFrom: migrated.from,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : null,
    },
    summary: { products: state.products.length, scenarios: state.scenarios.length, fixedCosts: state.fixedCosts.items.length },
  };
}
