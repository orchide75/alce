import { uid } from '../utils/id';
import type { AppState, FixedCostItem, Product } from './types';

export const APP_VERSION = '1.0.0';
export const SCHEMA_VERSION = 1;

/**
 * Categoriile de costuri fixe propuse inițial. Toate pornesc de la 0 –
 * aplicația nu inventează costuri; utilizatorul completează valorile reale.
 */
const DEFAULT_FIXED_COST_NAMES = [
  'Salarii',
  'Contabilitate',
  'Chirie',
  'Utilități',
  'Shopify',
  'Aplicații Shopify',
  'Software',
  'Agenții',
  'Customer support',
  'Call center',
  'Depozit (warehouse)',
  'Alte costuri fixe',
];

export function defaultFixedCostItems(): FixedCostItem[] {
  return DEFAULT_FIXED_COST_NAMES.map((name) => ({
    id: uid('fc'),
    name,
    monthlyAmount: 0,
    enabled: true,
  }));
}

export function createDefaultState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    companySettings: { name: '', cui: '', notes: '' },
    taxSettings: {
      // Cota standard de TVA în România (din 1 august 2025). Editabilă din Setări.
      vatRate: 0.21,
      customsDutyRate: 0,
      otherTaxes: [],
    },
    fx: { rates: { EUR: null, USD: null, CNY: null, GBP: null, HUF: null, PLN: null, TRY: null }, updatedAt: null },
    fixedCosts: { items: defaultFixedCostItems() },
    variableCosts: {
      shippingCost: 0,
      shippingFeeChargedGross: 0,
      fulfillmentPerOrder: 0,
      pickPackPerOrder: 0,
      packagingPerOrder: 0,
      inboundLogisticsPerUnit: 0,
      paymentProcessorPct: 0,
      paymentProcessorFixed: 0,
      codShare: 0,
      codFeePct: 0,
      codFeeFixed: 0,
      smsPerOrder: 0,
      callCenterPerOrder: 0,
      other: [],
    },
    returnSettings: {
      returnRate: 0,
      refusalRate: 0,
      failedDeliveryRate: 0,
      returnShippingCost: 0,
      returnProcessingCost: 0,
      unsellableRate: 0,
    },
    allocation: { includeFixedCosts: true, basis: 'delivered', monthlyOrders: 0 },
    products: [],
    scenarios: [],
    preferences: {
      daysPerMonth: 30,
      defaultOrdersPerDay: 10,
      nearBreakEvenThreshold: 0.05,
      projectionStatuses: ['testare', 'activ', 'scalare'],
      productsTable: { sortKey: 'updatedAt', sortDir: 'desc', statusFilter: 'all', profitFilter: 'all' },
      lastExportAt: null,
    },
  };
}

export function createEmptyProduct(): Product {
  const now = new Date().toISOString();
  return {
    id: uid('p'),
    name: '',
    supplierUrl: '',
    supplierCost: 0,
    currency: 'RON',
    fxRate: null,
    supplierCostIncludesVat: false,
    sellingPriceGross: 0,
    cpa: 0,
    unitsPerOrder: 1,
    ordersPerDay: null,
    status: 'idee',
    notes: '',
    overrides: {},
    extraCosts: [],
    createdAt: now,
    updatedAt: now,
  };
}
