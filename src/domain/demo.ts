/**
 * Date DEMO – exclusiv pentru explorarea aplicației. Sunt încărcate doar la
 * cererea explicită a utilizatorului (Date & backup → Încarcă date demo) și
 * NU reprezintă costuri reale.
 */
import { createDefaultState, createEmptyProduct } from './defaults';
import type { AppState, Product } from './types';

export function createDemoState(): AppState {
  const s = createDefaultState();
  s.companySettings = { name: 'Magazin Demo SRL', cui: '', notes: 'Date demonstrative – înlocuiește-le cu valorile tale.' };
  s.fx.rates = { ...s.fx.rates, EUR: 4.97, USD: 4.4, CNY: 0.61 };
  s.fx.updatedAt = new Date().toISOString();
  const amounts: Record<string, number> = {
    Salarii: 18000,
    Contabilitate: 1500,
    Chirie: 4000,
    Utilități: 800,
    Shopify: 450,
    'Aplicații Shopify': 600,
    Software: 400,
    'Customer support': 3500,
  };
  s.fixedCosts.items = s.fixedCosts.items.map((i) => ({ ...i, monthlyAmount: amounts[i.name] ?? 0 }));
  Object.assign(s.variableCosts, {
    shippingCost: 17,
    shippingFeeChargedGross: 0,
    fulfillmentPerOrder: 2,
    pickPackPerOrder: 1.5,
    packagingPerOrder: 1.2,
    inboundLogisticsPerUnit: 3,
    paymentProcessorPct: 0.019,
    paymentProcessorFixed: 1.25,
    codShare: 0.75,
    codFeePct: 0.01,
    codFeeFixed: 1.5,
    smsPerOrder: 0.25,
    callCenterPerOrder: 1.8,
  });
  Object.assign(s.returnSettings, {
    returnRate: 0.04,
    refusalRate: 0.1,
    failedDeliveryRate: 0.03,
    returnShippingCost: 12,
    returnProcessingCost: 3,
    unsellableRate: 0.15,
  });
  s.allocation = { includeFixedCosts: true, basis: 'delivered', monthlyOrders: 3000 };

  const mk = (p: Partial<Product>): Product => ({ ...createEmptyProduct(), ...p });
  s.products = [
    mk({ name: 'Lampă LED cu senzor de mișcare (DEMO)', supplierUrl: 'https://example.com/lampa-led-senzor-miscare', supplierCost: 4.2, currency: 'USD', sellingPriceGross: 149.99, cpa: 30, ordersPerDay: 25, status: 'scalare' }),
    mk({ name: 'Organizator portabil bagaje (DEMO)', supplierUrl: 'https://example.com/organizator-bagaje', supplierCost: 38, currency: 'CNY', sellingPriceGross: 119.99, cpa: 24, ordersPerDay: 15, status: 'activ' }),
    mk({ name: 'Perie electrică curățare (DEMO)', supplierUrl: 'https://example.com/perie-electrica', supplierCost: 9.5, currency: 'EUR', sellingPriceGross: 189.99, cpa: 48, ordersPerDay: 8, status: 'testare', overrides: { returnRate: 0.08 } }),
    mk({ name: 'Set cuțite ceramice (DEMO)', supplierUrl: 'https://example.com/set-cutite', supplierCost: 45, currency: 'RON', sellingPriceGross: 89.99, cpa: 41, ordersPerDay: 10, status: 'testare', overrides: { shippingCost: 22 } }),
  ];
  return s;
}
