/**
 * Helpers numerice. Garantează că nicio valoare NaN/Infinity nu intră sau iese
 * din motorul de calcul.
 */

/** Convertește orice valoare la un număr finit; altfel întoarce `fallback`. */
export function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** Număr finit și ≥ 0. */
export function nonNeg(value: unknown): number {
  return Math.max(0, num(value));
}

/** Fracție limitată la intervalul [0, 1]. */
export function rate(value: unknown): number {
  return Math.min(1, Math.max(0, num(value)));
}

/** Împărțire sigură: întoarce `null` dacă numitorul e 0 sau rezultatul nu e finit. */
export function safeDiv(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}

export function sum(values: number[]): number {
  let s = 0;
  for (const v of values) s += num(v);
  return s;
}

/** Media valorilor non-null. `null` dacă lista e goală. */
export function mean(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (valid.length === 0) return null;
  return sum(valid) / valid.length;
}

/** Elimină zgomotul de virgulă mobilă (ex. -0, 1e-13) – doar pentru comparații/afișare. */
export function clean(v: number): number {
  return Math.abs(v) < 1e-9 ? 0 : v;
}
