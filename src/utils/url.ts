/** Utilitare pentru URL-ul furnizorului. Nimic din aplicație nu depinde de ele. */

/** Întoarce URL-ul doar dacă este http(s); altfel null (previne `javascript:` etc.). */
export function safeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Sugerează un nume de produs din slug-ul URL-ului (funcționează offline). */
export function nameFromUrl(u: string): string | null {
  const s = safeUrl(u);
  if (!s) return null;
  const url = new URL(s);
  const segments = url.pathname.split('/').filter(Boolean).reverse();
  for (const seg of segments) {
    const clean = decodeURIComponent(seg)
      .replace(/\.(html?|php|aspx?)$/i, '')
      .replace(/[-_+]+/g, ' ')
      .replace(/\b(g|p|i|item|product|products|dp)\b/gi, ' ')
      .replace(/\b[a-z]*\d{5,}[a-z0-9]*\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const words = clean.split(' ').filter((w) => /[a-zA-ZăâîșțĂÂÎȘȚ]/.test(w));
    if (words.length >= 2) {
      const txt = words.slice(0, 10).join(' ');
      return txt.charAt(0).toUpperCase() + txt.slice(1);
    }
  }
  return null;
}

export interface FetchedInfo {
  title: string | null;
  price: number | null;
  currency: string | null;
  image: string | null;
}

/**
 * Încearcă să citească pagina furnizorului direct din browser. Majoritatea
 * site-urilor blochează acest lucru (CORS) – în acest caz întoarcem o eroare
 * explicită, iar utilizatorul introduce datele manual.
 */
export async function fetchProductInfo(u: string, timeoutMs = 7000): Promise<FetchedInfo> {
  const s = safeUrl(u);
  if (!s) throw new Error('URL invalid – trebuie să înceapă cu http:// sau https://');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let html: string;
  try {
    const res = await fetch(s, { signal: ctrl.signal, mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`Site-ul a răspuns cu eroarea ${res.status}.`);
    html = await res.text();
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('Site-ul nu a răspuns în timp util.');
    if (e instanceof TypeError) {
      throw new Error('Site-ul nu permite citirea din browser (CORS / protecție anti-bot). Introdu datele manual – calculatorul funcționează la fel.');
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = (sel: string) => doc.querySelector(sel)?.getAttribute('content')?.trim() || null;
  const title = meta('meta[property="og:title"]') ?? meta('meta[name="twitter:title"]') ?? doc.querySelector('title')?.textContent?.trim() ?? null;
  const priceRaw =
    meta('meta[property="product:price:amount"]') ?? meta('meta[property="og:price:amount"]') ?? meta('meta[itemprop="price"]');
  const currency = meta('meta[property="product:price:currency"]') ?? meta('meta[property="og:price:currency"]');
  const price = priceRaw ? Number(priceRaw.replace(',', '.')) : null;
  return {
    title,
    price: price !== null && Number.isFinite(price) ? price : null,
    currency,
    image: meta('meta[property="og:image"]'),
  };
}
