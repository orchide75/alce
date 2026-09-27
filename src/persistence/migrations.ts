/**
 * Migrări între versiuni de schemă. Fiecare migrare primește obiectul brut
 * la versiunea N și îl întoarce la versiunea N+1.
 * Pentru a adăuga o versiune nouă: incrementează SCHEMA_VERSION și adaugă
 * o funcție aici.
 */
import { SCHEMA_VERSION } from '../domain/defaults';

type Raw = Record<string, unknown>;

const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {
  // 1: (raw) => ({ ...raw, schemaVersion: 2, noulCamp: ... }),
};

export function migrate(raw: Raw): { data: Raw; from: number } {
  let v = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1;
  const from = v;
  let data: Raw = { ...raw, schemaVersion: v };
  while (v < SCHEMA_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`Lipsește migrarea de la schema v${v} la v${v + 1}.`);
    data = m(data);
    v++;
    data.schemaVersion = v;
  }
  return { data, from };
}
