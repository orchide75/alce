/**
 * Rezolvarea inputurilor: combină valorile produsului, override-urile și
 * setările companiei într-un set unic de numere (EngineInputs), păstrând
 * pentru fiecare valoare SURSA ei, pentru trasabilitate.
 */
import type { EngineSettings, OverrideKey, Product, ProductExtraCost, CustomTax, OtherVariableCost, AllocationBasis } from '../types';
import { nonNeg, num, rate, sum, safeDiv } from './math';
import { fmtNum, fmtRon } from '../../utils/format';

export type ValueSource = 'produs' | 'override' | 'setări' | 'implicit' | 'lipsă';

export interface Traced {
  value: number;
  source: ValueSource;
}

export interface EngineWarning {
  level: 'error' | 'warning' | 'info';
  message: string;
}

/** Toate numerele de care are nevoie motorul. Complet determinist. */
export interface EngineInputs {
  sellingPriceGross: number;
  unitsPerOrder: number;
  cpa: number;
  ordersPerDay: number;
  daysPerMonth: number;
  vatRate: number;

  /** Cost furnizor per unitate, RON, fără TVA (după curs și eliminare TVA). */
  supplierCostRon: number;
  inboundLogisticsPerUnit: number;
  customsDutyRate: number;

  shippingCost: number;
  shippingFeeChargedGross: number;
  fulfillmentPerOrder: number;
  pickPackPerOrder: number;
  packagingPerOrder: number;
  paymentProcessorPct: number;
  paymentProcessorFixed: number;
  codShare: number;
  codFeePct: number;
  codFeeFixed: number;
  smsPerOrder: number;
  callCenterPerOrder: number;

  returnRate: number;
  refusalRate: number;
  failedDeliveryRate: number;
  returnShippingCost: number;
  returnProcessingCost: number;
  unsellableRate: number;

  otherVariable: OtherVariableCost[];
  otherTaxes: CustomTax[];
  extraCosts: ProductExtraCost[];

  includeFixedCosts: boolean;
  allocationBasis: AllocationBasis;
  /** Cost fix per comandă din baza de alocare (plasată sau livrată). */
  fixedCostPerBasisOrder: number;
  totalMonthlyFixedCosts: number;
  monthlyOrdersForAllocation: number;
}

export type TracedKey = Exclude<
  keyof EngineInputs,
  'otherVariable' | 'otherTaxes' | 'extraCosts' | 'includeFixedCosts' | 'allocationBasis'
>;

export interface ResolvedInputs {
  inputs: EngineInputs;
  sources: Partial<Record<TracedKey, ValueSource>>;
  /** Detalii conversie valutară. */
  fx: { currency: string; rate: number; source: ValueSource; supplierCostOriginal: number };
  warnings: EngineWarning[];
}

/** Maparea cheie override → sursa default din setări. */
function defaultFor(key: OverrideKey, s: EngineSettings): number {
  switch (key) {
    case 'vatRate':
      return s.taxSettings.vatRate;
    case 'customsDutyRate':
      return s.taxSettings.customsDutyRate;
    case 'returnRate':
    case 'refusalRate':
    case 'failedDeliveryRate':
    case 'returnShippingCost':
    case 'returnProcessingCost':
    case 'unsellableRate':
      return s.returnSettings[key];
    default:
      return s.variableCosts[key];
  }
}

const RATE_KEYS: OverrideKey[] = [
  'vatRate',
  'customsDutyRate',
  'paymentProcessorPct',
  'codShare',
  'codFeePct',
  'returnRate',
  'refusalRate',
  'failedDeliveryRate',
  'unsellableRate',
];

export function isOverridden(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function totalFixedCosts(s: EngineSettings): number {
  return sum(s.fixedCosts.items.filter((i) => i.enabled).map((i) => nonNeg(i.monthlyAmount)));
}

/** Cost fix per comandă (din baza de alocare). `null` dacă nu există comenzi lunare. */
export function fixedCostPerOrder(s: EngineSettings): number | null {
  return safeDiv(totalFixedCosts(s), nonNeg(s.allocation.monthlyOrders));
}

export function resolveInputs(product: Product, s: EngineSettings): ResolvedInputs {
  const warnings: EngineWarning[] = [];
  const sources: ResolvedInputs['sources'] = {};

  const resolve = (key: OverrideKey): number => {
    const ov = product.overrides?.[key];
    const clampFn = RATE_KEYS.includes(key) ? rate : nonNeg;
    if (isOverridden(ov)) {
      sources[key] = 'override';
      return clampFn(ov);
    }
    sources[key] = 'setări';
    return clampFn(defaultFor(key, s));
  };

  // --- Preț și cantitate ---
  const sellingPriceGross = nonNeg(product.sellingPriceGross);
  sources.sellingPriceGross = 'produs';
  if (sellingPriceGross <= 0) warnings.push({ level: 'error', message: 'Prețul de vânzare lipsește sau este 0 – nu există venit.' });

  let unitsPerOrder = num(product.unitsPerOrder);
  sources.unitsPerOrder = 'produs';
  if (!(unitsPerOrder > 0)) {
    warnings.push({ level: 'warning', message: 'Unități per comandă invalid (≤ 0) – se folosește 1.' });
    unitsPerOrder = 1;
    sources.unitsPerOrder = 'implicit';
  }

  const cpa = nonNeg(product.cpa);
  sources.cpa = 'produs';
  if (cpa === 0) warnings.push({ level: 'info', message: 'CPA = 0 – profitul nu include cost de marketing.' });

  let ordersPerDay: number;
  if (isOverridden(product.ordersPerDay)) {
    ordersPerDay = nonNeg(product.ordersPerDay);
    sources.ordersPerDay = 'produs';
  } else {
    ordersPerDay = nonNeg(s.preferences.defaultOrdersPerDay);
    sources.ordersPerDay = 'setări';
  }
  const daysPerMonth = nonNeg(s.preferences.daysPerMonth);
  sources.daysPerMonth = 'setări';

  const vatRate = resolve('vatRate');

  // --- Cost produs și conversie valutară ---
  const supplierCostOriginal = nonNeg(product.supplierCost);
  let fxRate = 1;
  let fxSource: ValueSource = 'implicit';
  if (product.currency !== 'RON') {
    const productRate = num(product.fxRate);
    const settingsRate = num(s.fx.rates[product.currency]);
    if (productRate > 0) {
      fxRate = productRate;
      fxSource = 'produs';
    } else if (settingsRate > 0) {
      fxRate = settingsRate;
      fxSource = 'setări';
    } else {
      fxRate = 0;
      fxSource = 'lipsă';
      warnings.push({
        level: 'error',
        message: `Cursul ${product.currency}/RON nu este configurat – costul produsului este calculat ca 0. Setează cursul în produs sau în Setări → Cursuri valutare.`,
      });
    }
  }
  let supplierCostRon = supplierCostOriginal * fxRate;
  if (product.supplierCostIncludesVat) supplierCostRon = supplierCostRon / (1 + vatRate);
  sources.supplierCostRon = fxSource === 'lipsă' ? 'lipsă' : 'produs';
  if (supplierCostOriginal === 0) warnings.push({ level: 'warning', message: 'Costul produsului de la furnizor este 0.' });

  const inboundLogisticsPerUnit = resolve('inboundLogisticsPerUnit');
  const customsDutyRate = resolve('customsDutyRate');

  // --- Rate retur / refuz ---
  const refusalRate = resolve('refusalRate');
  let failedDeliveryRate = resolve('failedDeliveryRate');
  if (refusalRate + failedDeliveryRate > 1) {
    warnings.push({
      level: 'warning',
      message: `Rata de refuz (${fmtNum(refusalRate * 100)}%) + rata de nelivrare (${fmtNum(failedDeliveryRate * 100)}%) depășesc 100% – nelivrarea a fost limitată la ${fmtNum((1 - refusalRate) * 100)}%.`,
    });
    failedDeliveryRate = 1 - refusalRate;
  }

  // --- Costuri fixe ---
  const totalMonthlyFixedCosts = totalFixedCosts(s);
  const monthlyOrdersForAllocation = nonNeg(s.allocation.monthlyOrders);
  let fixedCostPerBasisOrder = 0;
  if (s.allocation.includeFixedCosts && totalMonthlyFixedCosts > 0) {
    const per = safeDiv(totalMonthlyFixedCosts, monthlyOrdersForAllocation);
    if (per === null) {
      warnings.push({
        level: 'warning',
        message: `Costuri fixe de ${fmtRon(totalMonthlyFixedCosts)}/lună nu pot fi alocate: numărul de comenzi lunare este 0. Completează-l în Setări → Alocare costuri fixe.`,
      });
    } else {
      fixedCostPerBasisOrder = per;
    }
  }
  sources.fixedCostPerBasisOrder = 'setări';
  sources.totalMonthlyFixedCosts = 'setări';
  sources.monthlyOrdersForAllocation = 'setări';

  const inputs: EngineInputs = {
    sellingPriceGross,
    unitsPerOrder,
    cpa,
    ordersPerDay,
    daysPerMonth,
    vatRate,
    supplierCostRon,
    inboundLogisticsPerUnit,
    customsDutyRate,
    shippingCost: resolve('shippingCost'),
    shippingFeeChargedGross: resolve('shippingFeeChargedGross'),
    fulfillmentPerOrder: resolve('fulfillmentPerOrder'),
    pickPackPerOrder: resolve('pickPackPerOrder'),
    packagingPerOrder: resolve('packagingPerOrder'),
    paymentProcessorPct: resolve('paymentProcessorPct'),
    paymentProcessorFixed: resolve('paymentProcessorFixed'),
    codShare: resolve('codShare'),
    codFeePct: resolve('codFeePct'),
    codFeeFixed: resolve('codFeeFixed'),
    smsPerOrder: resolve('smsPerOrder'),
    callCenterPerOrder: resolve('callCenterPerOrder'),
    returnRate: resolve('returnRate'),
    refusalRate,
    failedDeliveryRate,
    returnShippingCost: resolve('returnShippingCost'),
    returnProcessingCost: resolve('returnProcessingCost'),
    unsellableRate: resolve('unsellableRate'),
    otherVariable: (s.variableCosts.other ?? []).filter((o) => o.enabled),
    otherTaxes: (s.taxSettings.otherTaxes ?? []).filter((t) => t.enabled),
    extraCosts: product.extraCosts ?? [],
    includeFixedCosts: !!s.allocation.includeFixedCosts,
    allocationBasis: s.allocation.basis,
    fixedCostPerBasisOrder,
    totalMonthlyFixedCosts,
    monthlyOrdersForAllocation,
  };

  // Valori 0 venite din setări: le marcăm ca presupuneri vizibile.
  for (const k of Object.keys(sources) as TracedKey[]) {
    if (sources[k] === 'setări' && inputs[k] === 0 && k !== 'shippingFeeChargedGross' && k !== 'customsDutyRate') {
      sources[k] = 'lipsă';
    }
  }

  return {
    inputs,
    sources,
    fx: { currency: product.currency, rate: fxRate, source: fxSource, supplierCostOriginal },
    warnings,
  };
}
