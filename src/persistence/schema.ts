/**
 * Schema de validare pentru importul JSON și pentru datele din localStorage.
 * Câmpurile opționale primesc valori default, astfel încât fișierele mai vechi
 * sau incomplete să poată fi importate fără a strica aplicația.
 */
import { z } from 'zod';
import { CURRENCIES, PRODUCT_STATUSES } from '../domain/types';

const finite = z.number().refine(Number.isFinite, { message: 'trebuie să fie un număr finit' });
const money = finite.default(0);
const fraction = finite.refine((v) => v >= 0 && v <= 1, { message: 'trebuie să fie între 0 și 1 (fracție)' });
const fractionD = fraction.default(0);
const optNum = finite.nullable().optional();
const str = z.string().default('');
const iso = z.string().default(() => new Date().toISOString());

const statusSchema = z.enum(PRODUCT_STATUSES as [string, ...string[]]);
const currencySchema = z.enum(CURRENCIES as [string, ...string[]]);

export const productSchema = z.object({
  id: z.string().min(1),
  name: str,
  supplierUrl: str,
  supplierCost: money,
  currency: currencySchema.default('RON'),
  fxRate: finite.nullable().default(null),
  supplierCostIncludesVat: z.boolean().default(false),
  sellingPriceGross: money,
  cpa: money,
  unitsPerOrder: finite.default(1),
  ordersPerDay: finite.nullable().default(null),
  status: statusSchema.default('idee'),
  notes: str,
  overrides: z
    .object({
      vatRate: optNum,
      customsDutyRate: optNum,
      shippingCost: optNum,
      shippingFeeChargedGross: optNum,
      fulfillmentPerOrder: optNum,
      pickPackPerOrder: optNum,
      packagingPerOrder: optNum,
      inboundLogisticsPerUnit: optNum,
      paymentProcessorPct: optNum,
      paymentProcessorFixed: optNum,
      codShare: optNum,
      codFeePct: optNum,
      codFeeFixed: optNum,
      smsPerOrder: optNum,
      callCenterPerOrder: optNum,
      returnRate: optNum,
      refusalRate: optNum,
      failedDeliveryRate: optNum,
      returnShippingCost: optNum,
      returnProcessingCost: optNum,
      unsellableRate: optNum,
    })
    .default({}),
  extraCosts: z
    .array(
      z.object({
        id: z.string().min(1),
        name: str,
        basis: z.enum(['per_unit', 'per_order', 'per_delivered_order']),
        amount: money,
      }),
    )
    .default([]),
  createdAt: iso,
  updatedAt: iso,
});

export const stateSchema = z.object({
  schemaVersion: z.number().int(),
  companySettings: z.object({ name: str, cui: str, notes: str }).default({ name: '', cui: '', notes: '' }),
  taxSettings: z.object({
    vatRate: fraction,
    customsDutyRate: fractionD,
    otherTaxes: z
      .array(
        z.object({
          id: z.string().min(1),
          name: str,
          basis: z.enum(['revenue_pct', 'per_order_fixed']),
          value: money,
          enabled: z.boolean().default(true),
        }),
      )
      .default([]),
  }),
  fx: z
    .object({
      rates: z.record(z.string(), finite.nullable()).default({}),
      updatedAt: z.string().nullable().default(null),
    })
    .default({ rates: {}, updatedAt: null }),
  fixedCosts: z.object({
    items: z.array(
      z.object({ id: z.string().min(1), name: str, monthlyAmount: money, enabled: z.boolean().default(true) }),
    ),
  }),
  variableCosts: z.object({
    shippingCost: money,
    shippingFeeChargedGross: money,
    fulfillmentPerOrder: money,
    pickPackPerOrder: money,
    packagingPerOrder: money,
    inboundLogisticsPerUnit: money,
    paymentProcessorPct: fractionD,
    paymentProcessorFixed: money,
    codShare: fractionD,
    codFeePct: fractionD,
    codFeeFixed: money,
    smsPerOrder: money,
    callCenterPerOrder: money,
    other: z
      .array(
        z.object({
          id: z.string().min(1),
          name: str,
          basis: z.enum(['per_order', 'per_unit', 'revenue_pct']),
          value: money,
          enabled: z.boolean().default(true),
        }),
      )
      .default([]),
  }),
  returnSettings: z.object({
    returnRate: fractionD,
    refusalRate: fractionD,
    failedDeliveryRate: fractionD,
    returnShippingCost: money,
    returnProcessingCost: money,
    unsellableRate: fractionD,
  }),
  allocation: z
    .object({
      includeFixedCosts: z.boolean().default(true),
      basis: z.enum(['placed', 'delivered']).default('delivered'),
      monthlyOrders: money,
    })
    .default({ includeFixedCosts: true, basis: 'delivered', monthlyOrders: 0 }),
  products: z.array(productSchema).default([]),
  scenarios: z
    .array(
      z.object({
        id: z.string().min(1),
        name: str,
        productId: z.string(),
        adjustments: z
          .object({
            cpa: finite.optional(),
            sellingPriceGross: finite.optional(),
            supplierCostRon: finite.optional(),
            returnRate: finite.optional(),
            refusalRate: finite.optional(),
            shippingCost: finite.optional(),
            ordersPerDay: finite.optional(),
          })
          .default({}),
        createdAt: iso,
      }),
    )
    .default([]),
  preferences: z
    .object({
      daysPerMonth: finite.default(30),
      defaultOrdersPerDay: finite.default(10),
      nearBreakEvenThreshold: finite.default(0.05),
      projectionStatuses: z.array(statusSchema).default(['testare', 'activ', 'scalare']),
      productsTable: z
        .object({
          sortKey: z.string().default('updatedAt'),
          sortDir: z.enum(['asc', 'desc']).default('desc'),
          statusFilter: z.string().default('all'),
          profitFilter: z.string().default('all'),
        })
        .default({ sortKey: 'updatedAt', sortDir: 'desc', statusFilter: 'all', profitFilter: 'all' }),
      lastExportAt: z.string().nullable().default(null),
    })
    .default({
      daysPerMonth: 30,
      defaultOrdersPerDay: 10,
      nearBreakEvenThreshold: 0.05,
      projectionStatuses: ['testare', 'activ', 'scalare'],
      productsTable: { sortKey: 'updatedAt', sortDir: 'desc', statusFilter: 'all', profitFilter: 'all' },
      lastExportAt: null,
    }),
});

/** Formatează erorile zod în mesaje lizibile, în română. */
export function formatIssues(error: z.ZodError, max = 8): string[] {
  const out = error.issues.slice(0, max).map((iss) => {
    const path = iss.path.length ? iss.path.join(' → ') : '(rădăcină)';
    let msg = iss.message;
    if (iss.code === 'invalid_type') msg = `tip invalid (așteptat: ${String((iss as { expected?: unknown }).expected)})`;
    else if (iss.code === 'invalid_value') msg = 'valoare nepermisă';
    return `${path}: ${msg}`;
  });
  if (error.issues.length > max) out.push(`… și încă ${error.issues.length - max} probleme`);
  return out;
}
