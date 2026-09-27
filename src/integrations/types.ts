/**
 * Contracte pentru integrările viitoare (Meta Ads, Google Ads, TikTok Ads,
 * Shopify, curieri). Aplicația NU depinde de ele – motorul de calcul primește
 * aceleași inputuri (CPA, rate de retur/refuz, volume), indiferent dacă vin
 * din formular sau dintr-o integrare.
 *
 * Plan de integrare:
 *  1. Un provider implementează una sau mai multe interfețe de mai jos.
 *  2. Datele reale se stochează separat (ex. `actuals[]` în AppState, schemă v2
 *     cu migrare în persistence/migrations.ts).
 *  3. Un „mapper” produce `ScenarioAdjustments` / override-uri de produs din
 *     datele reale → același motor calculează „actual vs forecast”.
 */

export interface DateRange {
  from: string; // ISO date
  to: string;
}

/** Cheltuieli de reclame și conversii per produs (Meta, Google, TikTok). */
export interface AdSpendProvider {
  id: string;
  fetchSpend(range: DateRange): Promise<AdSpendRow[]>;
}
export interface AdSpendRow {
  date: string;
  /** Legătura cu produsul intern (SKU, URL sau ID mapat manual). */
  productKey: string;
  spend: number; // RON, fără TVA
  purchases: number;
  purchaseValueGross: number;
}

/** Comenzi reale (Shopify). */
export interface OrderProvider {
  id: string;
  fetchOrders(range: DateRange): Promise<OrderRow[]>;
}
export interface OrderRow {
  orderId: string;
  date: string;
  productKey: string;
  units: number;
  grossValue: number;
  paymentMethod: 'cod' | 'card' | 'other';
}

/** Statusuri de livrare (curieri: Sameday, FAN Courier, Cargus, DPD…). */
export interface CourierProvider {
  id: string;
  fetchShipments(range: DateRange): Promise<ShipmentRow[]>;
}
export interface ShipmentRow {
  orderId: string;
  status: 'delivered' | 'refused' | 'failed' | 'returned' | 'in_transit';
  shippingCost: number;
  returnCost: number;
}

export interface IntegrationDescriptor {
  id: string;
  name: string;
  kind: 'ads' | 'orders' | 'courier';
  description: string;
}
