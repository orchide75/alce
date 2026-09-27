import { describe, expect, it } from 'vitest';
import { createDefaultState, createEmptyProduct } from '../domain/defaults';
import { buildExport, parseImport } from './exportImport';

function sample() {
  const s = createDefaultState();
  s.companySettings.name = 'Magazin SRL';
  s.taxSettings.vatRate = 0.19;
  s.taxSettings.otherTaxes.push({ id: 't1', name: 'Impozit micro', basis: 'revenue_pct', value: 0.01, enabled: true });
  s.fixedCosts.items[0].monthlyAmount = 12345.67;
  s.variableCosts.shippingCost = 17;
  s.variableCosts.other.push({ id: 'o1', name: 'Asigurare colet', basis: 'per_order', value: 0.5, enabled: true });
  s.returnSettings.refusalRate = 0.12;
  s.allocation.monthlyOrders = 2500;
  const p = { ...createEmptyProduct(), id: 'p1', name: 'Lampă', supplierCost: 7.5, currency: 'USD' as const, fxRate: 4.6, sellingPriceGross: 129.9, cpa: 38 };
  p.overrides.shippingCost = 22;
  p.extraCosts.push({ id: 'e1', name: 'Cadou', basis: 'per_order', amount: 3 });
  s.products.push(p);
  s.scenarios.push({ id: 's1', name: 'Test', productId: 'p1', adjustments: { cpa: 50 }, createdAt: new Date().toISOString() });
  s.preferences.daysPerMonth = 31;
  return s;
}

describe('Export / Import JSON', () => {
  it('export → import restaurează complet starea', () => {
    const s = sample();
    const file = buildExport(s);
    expect(file.schemaVersion).toBe(1);
    expect(file.version).toBeTruthy();
    const res = parseImport(JSON.stringify(file));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state).toEqual(s);
  });

  it('JSON invalid → eroare clară', () => {
    const res = parseImport('{ nu e json');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0]).toMatch(/JSON valid/);
  });

  it('lipsă schemaVersion → eroare', () => {
    const res = parseImport(JSON.stringify({ products: [] }));
    expect(res.ok).toBe(false);
  });

  it('schemă mai nouă → refuzat', () => {
    const f = buildExport(sample());
    const res = parseImport(JSON.stringify({ ...f, schemaVersion: 99 }));
    expect(res.ok).toBe(false);
  });

  it('valori invalide (TVA 150%, text în loc de număr) → erori cu cale', () => {
    const f = buildExport(sample()) as unknown as Record<string, any>;
    f.taxSettings.vatRate = 1.5;
    f.products[0].cpa = 'mult';
    const res = parseImport(JSON.stringify(f));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.join('\n')).toMatch(/taxSettings → vatRate/);
      expect(res.errors.join('\n')).toMatch(/products → 0 → cpa/);
    }
  });

  it('fișier minimal primește valorile default', () => {
    const d = createDefaultState();
    const res = parseImport(
      JSON.stringify({
        schemaVersion: 1,
        taxSettings: { vatRate: 0.21 },
        fixedCosts: { items: [] },
        variableCosts: {},
        returnSettings: {},
        products: [{ id: 'x', name: 'A' }],
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.products[0].unitsPerOrder).toBe(1);
      expect(res.state.products[0].currency).toBe('RON');
      expect(res.state.preferences.daysPerMonth).toBe(d.preferences.daysPerMonth);
    }
  });

  it('ID-uri duplicate → refuzat', () => {
    const f = buildExport(sample());
    f.products.push({ ...f.products[0] });
    expect(parseImport(JSON.stringify(f)).ok).toBe(false);
  });
});
