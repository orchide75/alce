/**
 * Metrici derivate: marje, profit per livrată / zi / lună, break-even,
 * CPA maxim pentru marje țintă, preț minim de vânzare.
 * Toate se bazează EXCLUSIV pe computeCore – nicio formulă duplicată.
 */
import { computeCore, type CoreResult } from './core';
import type { EngineInputs } from './inputs';
import { safeDiv } from './math';
import type { ProfitClass } from '../types';

export const TARGET_MARGINS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3] as const;
export const MIN_PRICE_MARGINS = [0.1, 0.2, 0.3] as const;

export interface MarginTarget {
  margin: number;
  /** `null` = marja nu poate fi atinsă. */
  value: number | null;
}

export interface BreakEven {
  /** CPA maxim la care profitul net (fully loaded) = 0. Poate fi negativ. */
  cpaNet: number;
  /** CPA maxim la care profitul de contribuție = 0. */
  cpaContribution: number;
  /** ROAS break-even pe valoarea brută a comenzilor plasate (cum raportează platformele de ads). */
  roasGross: number | null;
  /** ROAS break-even pe venitul net realizat (fără TVA, după retururi/refuzuri). */
  roasNet: number | null;
  /** ROAS actual (valoare brută comandă / CPA). */
  currentRoasGross: number | null;
  maxCpaForMargin: MarginTarget[];
  /** Preț minim (TVA inclus) la CPA curent pentru profit net = 0. */
  minPriceBreakEven: number | null;
  minPriceForMargin: MarginTarget[];
  /** Marja CPA: cât mai poate crește CPA până la break-even. */
  cpaHeadroom: number;
}

export interface Analysis extends CoreResult {
  contributionMargin: number | null;
  netMargin: number | null;
  profitPerDeliveredOrder: number | null;
  contributionPerDeliveredOrder: number | null;
  profitPer100Orders: number;
  monthlyOrders: number;
  deliveredOrdersPerMonth: number;
  profitPerDay: number;
  profitPerMonth: number;
  contributionPerDay: number;
  contributionPerMonth: number;
  revenuePerMonth: number;
  adSpendPerMonth: number;
  cogsPercentOfRevenue: number | null;
  breakEven: BreakEven;
}

/**
 * Rezolvă prețul brut g pentru care profitNet(g) = m × venit(g).
 * Ambele sunt funcții LINIARE în preț (venit, comisioane procentuale, taxe pe venit),
 * deci evaluăm motorul în două puncte și rezolvăm exact.
 */
export function solvePriceForMargin(inputs: EngineInputs, m: number): number | null {
  const G = 1000;
  const p0 = computeCore({ ...inputs, sellingPriceGross: 0 });
  const p1 = computeCore({ ...inputs, sellingPriceGross: G });
  const a = (p1.netProfit - p0.netProfit) / G; // pantă profit
  const b = p0.netProfit;
  const r1 = (p1.revenueExVat - p0.revenueExVat) / G; // pantă venit
  const r0 = p0.revenueExVat;
  const denom = a - m * r1;
  if (!(denom > 1e-12)) return null; // profitul nu crește suficient cu prețul → imposibil
  const g = (m * r0 - b) / denom;
  if (!Number.isFinite(g)) return null;
  return Math.max(0, g);
}

export function analyze(inputs: EngineInputs): Analysis {
  const c = computeCore(inputs);
  const R = c.revenueExVat;

  const contributionMargin = R > 0 ? c.contributionProfit / R : null;
  const netMargin = R > 0 ? c.netProfit / R : null;

  const monthlyOrders = inputs.ordersPerDay * inputs.daysPerMonth;
  const profitPerDay = c.netProfit * inputs.ordersPerDay;
  const contributionPerDay = c.contributionProfit * inputs.ordersPerDay;

  // Break-even CPA: profitul este liniar în CPA cu pantă −1.
  const cpaContribution = c.contributionBeforeMarketing;
  const cpaNet = c.contributionBeforeMarketing - c.fixedAllocated;

  const maxCpaForMargin: MarginTarget[] = TARGET_MARGINS.map((m) => {
    if (!(R > 0)) return { margin: m, value: null };
    const v = cpaNet - m * R;
    return { margin: m, value: v >= 0 ? v : null };
  });

  const minPriceForMargin: MarginTarget[] = MIN_PRICE_MARGINS.map((m) => ({
    margin: m,
    value: solvePriceForMargin(inputs, m),
  }));

  const breakEven: BreakEven = {
    cpaNet,
    cpaContribution,
    roasGross: cpaNet > 0 ? safeDiv(c.order.grossValue, cpaNet) : null,
    roasNet: cpaNet > 0 ? safeDiv(R, cpaNet) : null,
    currentRoasGross: safeDiv(c.order.grossValue, c.marketing),
    maxCpaForMargin,
    minPriceBreakEven: solvePriceForMargin(inputs, 0),
    minPriceForMargin,
    cpaHeadroom: cpaNet - c.marketing,
  };

  return {
    ...c,
    contributionMargin,
    netMargin,
    profitPerDeliveredOrder: safeDiv(c.netProfit, c.rates.delivered),
    contributionPerDeliveredOrder: safeDiv(c.contributionProfit, c.rates.delivered),
    profitPer100Orders: c.netProfit * 100,
    monthlyOrders,
    deliveredOrdersPerMonth: monthlyOrders * c.rates.delivered,
    profitPerDay,
    profitPerMonth: profitPerDay * inputs.daysPerMonth,
    contributionPerDay,
    contributionPerMonth: contributionPerDay * inputs.daysPerMonth,
    revenuePerMonth: R * monthlyOrders,
    adSpendPerMonth: c.marketing * monthlyOrders,
    cogsPercentOfRevenue: R > 0 ? (c.lines.find((l) => l.key === 'cogs')?.amount ?? 0) / R : null,
    breakEven,
  };
}

/**
 * Clasificare profitabilitate pe baza marjei nete:
 *   marjă ≥ +prag → profitabil; marjă ≤ −prag → neprofitabil; între → aproape de break-even.
 */
export function classify(netProfit: number, netMargin: number | null, threshold: number): ProfitClass {
  if (netMargin === null) return netProfit < 0 ? 'unprofitable' : 'unknown';
  if (netMargin >= threshold) return 'profitable';
  if (netMargin <= -threshold) return 'unprofitable';
  return 'near';
}

export const PROFIT_CLASS_LABEL: Record<ProfitClass, string> = {
  profitable: 'Profitabil',
  near: 'Aproape de break-even',
  unprofitable: 'Neprofitabil',
  unknown: 'Date insuficiente',
};
