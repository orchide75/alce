import { computeCore } from './core';
import type { EngineInputs } from './inputs';
import { classify } from './analyze';
import type { ProfitClass } from '../types';

export interface SensitivityRow {
  cpa: number;
  profitPerOrder: number;
  margin: number | null;
  monthlyProfit: number;
  roasGross: number | null;
  profitClass: ProfitClass;
  marker: 'current' | 'breakeven' | null;
}

const NICE_STEPS = [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

function niceStep(raw: number): number {
  for (const s of NICE_STEPS) if (s >= raw) return s;
  return Math.ceil(raw / 1000) * 1000;
}

/**
 * Tabel de sensibilitate la CPA: de la 5 lei până la un nivel relevant peste
 * CPA-ul de break-even (min. 1,5 × max(BE CPA, CPA curent)). Include rânduri
 * exacte pentru CPA-ul curent și CPA-ul de break-even.
 */
export function cpaSensitivity(inputs: EngineInputs, threshold: number, targetRows = 18): SensitivityRow[] {
  const base = computeCore({ ...inputs, cpa: 0 });
  const beCpa = base.contributionBeforeMarketing - base.fixedAllocated;
  const start = 5;
  const top = Math.max(beCpa * 1.5, inputs.cpa * 1.5, 50);
  const step = niceStep((top - start) / targetRows);
  const cpas = new Set<number>();
  for (let v = start; v <= top + 1e-9; v += step) cpas.add(Math.round(v * 100) / 100);
  const current = inputs.cpa;
  cpas.add(current);
  if (beCpa > 0) cpas.add(beCpa);

  const monthly = inputs.ordersPerDay * inputs.daysPerMonth;
  return [...cpas]
    .sort((a, b) => a - b)
    .map((cpa) => {
      const r = computeCore({ ...inputs, cpa });
      const margin = r.revenueExVat > 0 ? r.netProfit / r.revenueExVat : null;
      return {
        cpa,
        profitPerOrder: r.netProfit,
        margin,
        monthlyProfit: r.netProfit * monthly,
        roasGross: cpa > 0 ? r.order.grossValue / cpa : null,
        profitClass: classify(r.netProfit, margin, threshold),
        marker: cpa === current ? 'current' : beCpa > 0 && cpa === beCpa ? 'breakeven' : null,
      };
    });
}
