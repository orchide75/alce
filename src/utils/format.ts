/**
 * Formatare pentru afișare (ro-RO). Rotunjirea se face DOAR aici –
 * motorul de calcul lucrează cu precizie completă.
 */

const ronFmt = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ron0Fmt = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const numFmtCache = new Map<string, Intl.NumberFormat>();

function isNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function fixZero(v: number, decimals: number): number {
  // evită afișarea „-0,00”
  const f = 10 ** decimals;
  return Math.round(v * f) === 0 ? 0 : v;
}

export const DASH = '—';

/** 1.234,56 lei */
export function fmtRon(v: number | null | undefined, opts: { decimals?: 0 | 2; sign?: boolean } = {}): string {
  if (!isNum(v)) return DASH;
  const decimals = opts.decimals ?? 2;
  const x = fixZero(v, decimals);
  const s = (decimals === 0 ? ron0Fmt : ronFmt).format(x);
  return `${opts.sign && x > 0 ? '+' : ''}${s} lei`;
}

/** Sumă compactă pentru carduri: 12,4 mii lei / 1,2 mil. lei */
export function fmtRonCompact(v: number | null | undefined): string {
  if (!isNum(v)) return DASH;
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${fmtNum(v / 1_000_000, 2)} mil. lei`;
  if (a >= 100_000) return `${fmtNum(v / 1000, 1)} mii lei`;
  return fmtRon(v, { decimals: a >= 10_000 ? 0 : 2 });
}

/** Fracție → procent: 0.2134 → 21,3% */
export function fmtPct(v: number | null | undefined, decimals = 1, sign = false): string {
  if (!isNum(v)) return DASH;
  const x = fixZero(v * 100, decimals);
  const s = decimals === 1 ? pctFmt.format(x) : fmtNum(x, decimals);
  return `${sign && x > 0 ? '+' : ''}${s}%`;
}

export function fmtNum(v: number | null | undefined, maxDecimals = 2, minDecimals = 0): string {
  if (!isNum(v)) return DASH;
  const key = `${minDecimals}-${maxDecimals}`;
  let f = numFmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals });
    numFmtCache.set(key, f);
  }
  return f.format(fixZero(v, maxDecimals));
}

/** ROAS: 3,25x */
export function fmtX(v: number | null | undefined): string {
  if (!isNum(v)) return DASH;
  return `${fmtNum(v, 2, 2)}x`;
}

/**
 * Parsează un număr introdus de utilizator. Acceptă virgulă sau punct ca
 * separator zecimal și spații ca separator de mii. Întoarce `null` dacă
 * textul nu este un număr valid.
 */
export function parseNumberInput(raw: string): number | null {
  let s = raw.trim().replace(/\s| /g, '');
  if (s === '') return null;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // formatul cu separator de mii: 1.234,56 sau 1,234.56
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    s = s.replace(',', '.');
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Afișează un număr într-un input editabil (fără separator de mii). */
export function toInputString(v: number | null | undefined, maxDecimals = 6): string {
  if (!isNum(v)) return '';
  const r = Number(v.toFixed(maxDecimals));
  return String(r).replace('.', ',');
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return 'niciodată';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'niciodată';
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'acum câteva secunde';
  if (min < 60) return `acum ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `acum ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'acum o zi' : `acum ${d} zile`;
}
