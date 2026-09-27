/**
 * Punctul de intrare folosit de TOATE paginile (Dashboard, Produse, Detalii,
 * Simulator, Comparație). Garantează aceleași rezultate pentru aceleași inputuri.
 */
import type { EngineSettings, Product, ProfitClass, ScenarioAdjustments } from '../types';
import { analyze, classify, type Analysis } from './analyze';
import { resolveInputs, type EngineInputs, type EngineWarning, type ResolvedInputs } from './inputs';
import { nonNeg, rate } from './math';

export interface ProductResult {
  product: Product;
  resolved: ResolvedInputs;
  analysis: Analysis;
  profitClass: ProfitClass;
  warnings: EngineWarning[];
}

function buildWarnings(a: Analysis, resolved: ResolvedInputs): EngineWarning[] {
  const w = [...resolved.warnings];
  const i = a.inputs;
  const netUnitPrice = a.unit.netPrice;
  if (i.sellingPriceGross > 0 && netUnitPrice < a.unit.landedCost) {
    w.push({ level: 'error', message: 'Prețul fără TVA este sub costul landed al produsului – pierzi bani pe fiecare unitate, înainte de orice alt cost.' });
  }
  if (a.rates.kept === 0 && i.sellingPriceGross > 0) {
    w.push({ level: 'error', message: 'Nicio comandă nu rămâne vândută (100% refuz/nelivrare/retur) – venitul este 0, marjele nu pot fi calculate.' });
  }
  if (a.breakEven.cpaNet <= 0 && a.revenueExVat > 0) {
    w.push({ level: 'error', message: 'Produsul pierde bani chiar și la CPA 0 – nu există CPA de break-even.' });
  }
  if (i.ordersPerDay === 0) {
    w.push({ level: 'info', message: 'Comenzi/zi = 0 – proiecțiile zilnice și lunare sunt 0.' });
  }
  return w;
}

export function evaluateInputs(
  product: Product,
  resolved: ResolvedInputs,
  inputs: EngineInputs,
  settings: EngineSettings,
): ProductResult {
  const analysis = analyze(inputs);
  return {
    product,
    resolved: { ...resolved, inputs },
    analysis,
    profitClass: classify(analysis.netProfit, analysis.netMargin, settings.preferences.nearBreakEvenThreshold),
    warnings: buildWarnings(analysis, resolved),
  };
}

export function calculateProduct(product: Product, settings: EngineSettings): ProductResult {
  const resolved = resolveInputs(product, settings);
  return evaluateInputs(product, resolved, resolved.inputs, settings);
}

/** Aplică ajustările din simulator peste inputurile rezolvate ale produsului. */
export function applyAdjustments(inputs: EngineInputs, adj: ScenarioAdjustments): EngineInputs {
  const out = { ...inputs };
  if (adj.cpa !== undefined) out.cpa = nonNeg(adj.cpa);
  if (adj.sellingPriceGross !== undefined) out.sellingPriceGross = nonNeg(adj.sellingPriceGross);
  if (adj.supplierCostRon !== undefined) out.supplierCostRon = nonNeg(adj.supplierCostRon);
  if (adj.returnRate !== undefined) out.returnRate = rate(adj.returnRate);
  if (adj.refusalRate !== undefined) {
    out.refusalRate = rate(adj.refusalRate);
    out.failedDeliveryRate = Math.min(out.failedDeliveryRate, 1 - out.refusalRate);
  }
  if (adj.shippingCost !== undefined) out.shippingCost = nonNeg(adj.shippingCost);
  if (adj.ordersPerDay !== undefined) out.ordersPerDay = nonNeg(adj.ordersPerDay);
  return out;
}

export function calculateScenario(product: Product, settings: EngineSettings, adj: ScenarioAdjustments): ProductResult {
  const resolved = resolveInputs(product, settings);
  return evaluateInputs(product, resolved, applyAdjustments(resolved.inputs, adj), settings);
}
