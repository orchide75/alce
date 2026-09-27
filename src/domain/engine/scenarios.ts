import type { ScenarioAdjustments } from '../types';
import type { EngineInputs } from './inputs';

export type QuickScenario = 'conservator' | 'baza' | 'agresiv';

export const QUICK_SCENARIOS: { key: QuickScenario; label: string; description: string }[] = [
  {
    key: 'conservator',
    label: 'Conservator',
    description: 'CPA +25%, rată retur ×1,5, rată refuz ×1,5, comenzi/zi ×0,7',
  },
  { key: 'baza', label: 'Bază', description: 'Valorile actuale ale produsului' },
  {
    key: 'agresiv',
    label: 'Agresiv',
    description: 'CPA −15%, rată retur ×0,8, rată refuz ×0,8, comenzi/zi ×1,5',
  },
];

/** Ajustări pentru scenariile rapide, calculate relativ la valorile de bază. */
export function quickScenarioAdjustments(base: EngineInputs, key: QuickScenario): ScenarioAdjustments {
  const all: ScenarioAdjustments = {
    cpa: base.cpa,
    sellingPriceGross: base.sellingPriceGross,
    supplierCostRon: base.supplierCostRon,
    returnRate: base.returnRate,
    refusalRate: base.refusalRate,
    shippingCost: base.shippingCost,
    ordersPerDay: base.ordersPerDay,
  };
  if (key === 'conservator') {
    return {
      ...all,
      cpa: base.cpa * 1.25,
      returnRate: Math.min(1, base.returnRate * 1.5),
      refusalRate: Math.min(1, base.refusalRate * 1.5),
      ordersPerDay: base.ordersPerDay * 0.7,
    };
  }
  if (key === 'agresiv') {
    return {
      ...all,
      cpa: base.cpa * 0.85,
      returnRate: base.returnRate * 0.8,
      refusalRate: base.refusalRate * 0.8,
      ordersPerDay: base.ordersPerDay * 1.5,
    };
  }
  return all;
}
