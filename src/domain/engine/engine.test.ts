import { describe, expect, it } from 'vitest';
import { createDefaultState, createEmptyProduct } from '../defaults';
import type { AppState, Product } from '../types';
import {
  calculateProduct,
  calculateScenario,
  computeCore,
  cpaSensitivity,
  summarize,
  quickScenarioAdjustments,
  resolveInputs,
} from './index';

/** Setări de referință – aceleași valori ca în calculul independent (Python). */
function refState(): AppState {
  const s = createDefaultState();
  s.taxSettings.vatRate = 0.21;
  s.fx.rates.USD = 4.5;
  Object.assign(s.variableCosts, {
    shippingCost: 17,
    shippingFeeChargedGross: 0,
    fulfillmentPerOrder: 2,
    pickPackPerOrder: 1.5,
    packagingPerOrder: 1,
    inboundLogisticsPerUnit: 3,
    paymentProcessorPct: 0.019,
    paymentProcessorFixed: 1.25,
    codShare: 0.8,
    codFeePct: 0.01,
    codFeeFixed: 2,
    smsPerOrder: 0.3,
    callCenterPerOrder: 2,
  });
  Object.assign(s.returnSettings, {
    returnRate: 0.05,
    refusalRate: 0.1,
    failedDeliveryRate: 0.03,
    returnShippingCost: 12,
    returnProcessingCost: 3,
    unsellableRate: 0.2,
  });
  s.fixedCosts.items = [{ id: 'f1', name: 'Salarii', monthlyAmount: 30000, enabled: true }];
  s.allocation = { includeFixedCosts: true, basis: 'delivered', monthlyOrders: 3000 };
  return s;
}

function refProduct(): Product {
  return {
    ...createEmptyProduct(),
    id: 'p1',
    name: 'Produs test',
    supplierCost: 8,
    currency: 'USD',
    sellingPriceGross: 149.99,
    cpa: 45,
    unitsPerOrder: 1,
    ordersPerDay: 20,
  };
}

const close = (a: number | null, b: number, digits = 6) => {
  expect(a).not.toBeNull();
  expect(a as number).toBeCloseTo(b, digits);
};

describe('Motor de calcul – exemplu de referință', () => {
  const r = calculateProduct(refProduct(), refState());
  const a = r.analysis;

  it('calculează TVA prin împărțire, nu ca procent din brut', () => {
    close(a.unit.netPrice, 149.99 / 1.21);
    close(a.unit.vatPerUnit, 149.99 - 149.99 / 1.21);
    // NU 149.99 × 21%
    expect(Math.abs(a.unit.vatPerUnit - 149.99 * 0.21)).toBeGreaterThan(1);
  });

  it('venit, costuri variabile, contribuție, profit net', () => {
    close(a.revenueExVat, 102.45184710743803);
    close(a.variableCosts, 63.24519239999999);
    close(a.contributionBeforeMarketing, 39.206654707438034);
    close(a.contributionProfit, -5.793345292561966);
    close(a.fixedAllocated, 8.7);
    close(a.netProfit, -14.493345292561965);
  });

  it('marje și proiecții', () => {
    close(a.contributionMargin, -0.05654700677564815);
    close(a.netMargin, -0.14146494867352905);
    close(a.profitPerDeliveredOrder, -16.659017577657433);
    close(a.profitPerMonth, -8696.00717553718, 4);
    close(a.profitPer100Orders, -1449.3345292561965, 4);
  });

  it('break-even CPA și ROAS', () => {
    close(a.breakEven.cpaNet, 30.506654707438035);
    close(a.breakEven.roasGross, 4.916632172174221);
    close(a.breakEven.roasNet, 3.3583442068611524);
  });

  it('CPA maxim pentru marje țintă', () => {
    const expected = [25.38406235206613, 20.26146999669423, 15.138877641322331, 10.016285285950428, 4.893692930578528];
    expected.forEach((v, idx) => close(a.breakEven.maxCpaForMargin[idx].value, v));
    // 30% nu poate fi atins nici la CPA 0 → null
    expect(a.breakEven.maxCpaForMargin[5].value).toBeNull();
  });

  it('preț minim de vânzare', () => {
    close(a.breakEven.minPriceBreakEven, 171.54792297392783, 5);
    close(a.breakEven.minPriceForMargin[0].value, 190.9483691428271, 5);
    close(a.breakEven.minPriceForMargin[1].value, 215.2963480537208, 5);
    close(a.breakEven.minPriceForMargin[2].value, 246.76104591371214, 5);
  });

  it('prețul minim găsit produce exact marja țintă (verificare inversă)', () => {
    const base = resolveInputs(refProduct(), refState()).inputs;
    const p = a.breakEven.minPriceForMargin[1].value as number;
    const c = computeCore({ ...base, sellingPriceGross: p });
    close(c.netProfit / c.revenueExVat, 0.2, 9);
  });

  it('CPA break-even produce profit net 0', () => {
    const base = resolveInputs(refProduct(), refState()).inputs;
    const c = computeCore({ ...base, cpa: a.breakEven.cpaNet });
    close(c.netProfit, 0, 9);
  });

  it('liniile de cost se adună la totalul costurilor variabile', () => {
    const s = a.lines.reduce((x, l) => x + l.amount, 0);
    close(s, a.variableCosts, 9);
  });
});

describe('Consistență între pagini', () => {
  it('Simulatorul fără ajustări = Detalii produs = Dashboard', () => {
    const st = refState();
    const p = refProduct();
    p.status = 'activ';
    st.products = [p];
    const detail = calculateProduct(p, st).analysis;
    const sim = calculateScenario(p, st, {}).analysis;
    const simBase = calculateScenario(p, st, quickScenarioAdjustments(resolveInputs(p, st).inputs, 'baza')).analysis;
    const dash = summarize(st);
    for (const x of [sim, simBase, dash.results[0].analysis]) {
      expect(x.netProfit).toBe(detail.netProfit);
      expect(x.contributionProfit).toBe(detail.contributionProfit);
      expect(x.breakEven.cpaNet).toBe(detail.breakEven.cpaNet);
      expect(x.profitPerMonth).toBe(detail.profitPerMonth);
    }
    expect(dash.monthlyNetAllocated).toBe(detail.profitPerMonth);
    close(dash.monthlyNetReal, detail.contributionPerMonth - 30000, 6);
  });

  it('tabelul de sensibilitate folosește același motor', () => {
    const st = refState();
    const inputs = resolveInputs(refProduct(), st).inputs;
    const rows = cpaSensitivity(inputs, 0.05);
    const cur = rows.find((r) => r.marker === 'current')!;
    close(cur.profitPerOrder, calculateProduct(refProduct(), st).analysis.netProfit, 9);
    const be = rows.find((r) => r.marker === 'breakeven')!;
    close(be.profitPerOrder, 0, 9);
    expect(rows[0].cpa).toBe(5);
    expect(rows[rows.length - 1].cpa).toBeGreaterThan(30.5);
  });
});

describe('Cazuri limită – niciun NaN / Infinity', () => {
  const finiteDeep = (obj: unknown, path = ''): void => {
    if (typeof obj === 'number') {
      expect(Number.isFinite(obj), `${path} = ${obj}`).toBe(true);
    } else if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) finiteDeep(v, `${path}.${k}`);
    }
  };

  const cases: [string, (s: AppState, p: Product) => void][] = [
    ['0 comenzi lunare', (s) => (s.allocation.monthlyOrders = 0)],
    ['CPA 0', (_s, p) => (p.cpa = 0)],
    ['cost produs 0', (_s, p) => (p.supplierCost = 0)],
    ['100% retururi', (s) => (s.returnSettings.returnRate = 1)],
    ['100% refuzuri', (s) => (s.returnSettings.refusalRate = 1)],
    ['refuz + nelivrare > 100%', (s) => { s.returnSettings.refusalRate = 0.8; s.returnSettings.failedDeliveryRate = 0.5; }],
    ['CPA foarte mare', (_s, p) => (p.cpa = 1e7)],
    ['TVA 0%', (s) => (s.taxSettings.vatRate = 0)],
    ['preț lipsă', (_s, p) => (p.sellingPriceGross = 0)],
    ['valori invalide', (_s, p) => { p.sellingPriceGross = NaN; p.cpa = Infinity; p.unitsPerOrder = -3; p.supplierCost = 'abc' as unknown as number; }],
    ['curs lipsă', (s) => (s.fx.rates.USD = null)],
    ['preț sub cost', (_s, p) => (p.sellingPriceGross = 10)],
    ['comenzi/zi 0', (_s, p) => (p.ordersPerDay = 0)],
    ['zecimale', (_s, p) => { p.unitsPerOrder = 1.37; p.sellingPriceGross = 99.999; }],
    ['totul la zero', (s, p) => { Object.assign(s, createDefaultState()); Object.assign(p, createEmptyProduct()); }],
  ];

  for (const [name, mutate] of cases) {
    it(name, () => {
      const s = refState();
      const p = refProduct();
      mutate(s, p);
      const r = calculateProduct(p, s);
      const { inputs: _i, ...rest } = r.analysis;
      finiteDeep(rest, name);
      expect(['profitable', 'near', 'unprofitable', 'unknown']).toContain(r.profitClass);
      const rows = cpaSensitivity(r.analysis.inputs, 0.05);
      finiteDeep(rows.map(({ margin, roasGross, ...x }) => ({ ...x, margin: margin ?? 0, roasGross: roasGross ?? 0 })), name);
    });
  }

  it('100% refuzuri: venit 0, marje null, pierdere = costuri', () => {
    const s = refState();
    s.returnSettings.refusalRate = 1;
    const a = calculateProduct(refProduct(), s).analysis;
    expect(a.revenueExVat).toBe(0);
    expect(a.netMargin).toBeNull();
    expect(a.profitPerDeliveredOrder).toBeNull();
    expect(a.netProfit).toBeLessThan(0);
  });

  it('0 comenzi lunare: alocare 0 + avertisment', () => {
    const s = refState();
    s.allocation.monthlyOrders = 0;
    const r = calculateProduct(refProduct(), s);
    expect(r.analysis.fixedAllocated).toBe(0);
    expect(r.warnings.some((w) => w.message.includes('nu pot fi alocate'))).toBe(true);
  });

  it('dezactivarea costurilor fixe → profit net = contribuție', () => {
    const s = refState();
    s.allocation.includeFixedCosts = false;
    const a = calculateProduct(refProduct(), s).analysis;
    expect(a.netProfit).toBe(a.contributionProfit);
  });

  it('TVA 0%: net = brut', () => {
    const s = refState();
    s.taxSettings.vatRate = 0;
    const a = calculateProduct(refProduct(), s).analysis;
    expect(a.unit.netPrice).toBe(149.99);
    expect(a.unit.vatPerUnit).toBe(0);
  });

  it('override de produs are prioritate față de setări', () => {
    const p = refProduct();
    p.overrides.shippingCost = 22;
    const r = calculateProduct(p, refState());
    expect(r.analysis.lines.find((l) => l.key === 'shipping')!.amount).toBe(22);
    expect(r.resolved.sources.shippingCost).toBe('override');
  });

  it('alocare pe comenzi plasate', () => {
    const s = refState();
    s.allocation.basis = 'placed';
    expect(calculateProduct(refProduct(), s).analysis.fixedAllocated).toBe(10);
  });
});
