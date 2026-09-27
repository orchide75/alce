import { uid } from '../utils/id';
import type { AppState, Product, Scenario } from '../domain/types';
import { update } from './store';

export function upsertProduct(p: Product) {
  update((s) => {
    const now = new Date().toISOString();
    const exists = s.products.some((x) => x.id === p.id);
    const product = { ...p, updatedAt: now, createdAt: exists ? p.createdAt : now };
    return {
      ...s,
      products: exists ? s.products.map((x) => (x.id === p.id ? product : x)) : [product, ...s.products],
    };
  });
}

export function deleteProduct(id: string) {
  update((s) => ({
    ...s,
    products: s.products.filter((p) => p.id !== id),
    scenarios: s.scenarios.filter((sc) => sc.productId !== id),
  }));
}

export function duplicateProduct(id: string): string | null {
  let newId: string | null = null;
  update((s) => {
    const src = s.products.find((p) => p.id === id);
    if (!src) return s;
    const now = new Date().toISOString();
    newId = uid('p');
    const copy: Product = {
      ...structuredClone(src),
      id: newId,
      name: `${src.name || 'Produs'} (copie)`,
      extraCosts: src.extraCosts.map((e) => ({ ...e, id: uid('ex') })),
      createdAt: now,
      updatedAt: now,
    };
    const idx = s.products.findIndex((p) => p.id === id);
    const products = [...s.products];
    products.splice(idx + 1, 0, copy);
    return { ...s, products };
  });
  return newId;
}

export function setProductStatus(id: string, status: Product['status']) {
  update((s) => ({
    ...s,
    products: s.products.map((p) => (p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p)),
  }));
}

export function saveScenario(sc: Omit<Scenario, 'id' | 'createdAt'>) {
  update((s) => ({ ...s, scenarios: [{ ...sc, id: uid('sc'), createdAt: new Date().toISOString() }, ...s.scenarios] }));
}

export function deleteScenario(id: string) {
  update((s) => ({ ...s, scenarios: s.scenarios.filter((x) => x.id !== id) }));
}

export function updateSettings(fn: (s: AppState) => AppState) {
  update(fn);
}

export function updatePreferences(fn: (p: AppState['preferences']) => AppState['preferences'], isDataChange = false) {
  update((s) => ({ ...s, preferences: fn(s.preferences) }), isDataChange);
}
