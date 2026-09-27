/**
 * Modelul de date al aplicației.
 *
 * Convenții:
 * - Toate sumele monetare sunt în RON, FĂRĂ TVA, cu excepția câmpurilor care au
 *   explicit sufixul `Gross` (TVA inclus) sau a costului de la furnizor în altă monedă.
 * - Toate procentele sunt stocate ca fracții (0.21 = 21%).
 */

export type CurrencyCode = 'RON' | 'EUR' | 'USD' | 'CNY' | 'GBP' | 'HUF' | 'PLN' | 'TRY';

export const CURRENCIES: CurrencyCode[] = ['RON', 'EUR', 'USD', 'CNY', 'GBP', 'HUF', 'PLN', 'TRY'];

export interface CompanySettings {
  name: string;
  cui: string;
  notes: string;
}

/** Bază de calcul pentru o taxă configurabilă. */
export type TaxBasis = 'revenue_pct' | 'per_order_fixed';

export interface CustomTax {
  id: string;
  name: string;
  basis: TaxBasis;
  /** Fracție pentru `revenue_pct`, RON pentru `per_order_fixed`. */
  value: number;
  enabled: boolean;
}

export interface TaxSettings {
  /** Cota TVA standard (fracție). */
  vatRate: number;
  /** Taxă vamală aplicată pe (cost furnizor + transport inbound), per unitate. */
  customsDutyRate: number;
  otherTaxes: CustomTax[];
}

export interface FxSettings {
  /** RON pentru 1 unitate din moneda respectivă. `null` / 0 = neconfigurat. */
  rates: Partial<Record<CurrencyCode, number | null>>;
  updatedAt: string | null;
}

export interface FixedCostItem {
  id: string;
  name: string;
  /** Sumă lunară, RON fără TVA. */
  monthlyAmount: number;
  enabled: boolean;
}

export interface FixedCosts {
  items: FixedCostItem[];
}

export type VariableCostBasis = 'per_order' | 'per_unit' | 'revenue_pct';

export interface OtherVariableCost {
  id: string;
  name: string;
  basis: VariableCostBasis;
  /** RON pentru per_order/per_unit, fracție pentru revenue_pct. */
  value: number;
  enabled: boolean;
}

/** Costuri variabile default – toate în RON fără TVA, per comandă plasată/expediată. */
export interface VariableCosts {
  /** Cost transport către client, per colet expediat. */
  shippingCost: number;
  /** Taxa de livrare încasată de la client (TVA inclus). 0 = livrare gratuită. */
  shippingFeeChargedGross: number;
  fulfillmentPerOrder: number;
  pickPackPerOrder: number;
  packagingPerOrder: number;
  /** Transport de la furnizor la depozit, per unitate. */
  inboundLogisticsPerUnit: number;
  /** Comision procesator plăți (card), fracție din valoarea brută a comenzii. */
  paymentProcessorPct: number;
  /** Comision fix procesator plăți (card), per tranzacție. */
  paymentProcessorFixed: number;
  /** Ponderea comenzilor plătite ramburs (COD). Restul = card/online. */
  codShare: number;
  /** Comision ramburs, fracție din suma încasată. */
  codFeePct: number;
  /** Comision fix ramburs per colet încasat. */
  codFeeFixed: number;
  smsPerOrder: number;
  callCenterPerOrder: number;
  other: OtherVariableCost[];
}

export interface ReturnSettings {
  /** % din comenzile LIVRATE care sunt returnate ulterior de client. */
  returnRate: number;
  /** % din comenzile PLASATE (expediate) refuzate la livrare. */
  refusalRate: number;
  /** % din comenzile PLASATE (expediate) care nu pot fi livrate (adresă greșită, client de negăsit). */
  failedDeliveryRate: number;
  /** Cost transport retur per colet întors (retur, refuz sau nelivrat). */
  returnShippingCost: number;
  /** Cost procesare per colet întors (recepție, verificare, reambalare). */
  returnProcessingCost: number;
  /** % din marfa întoarsă care nu mai poate fi revândută. */
  unsellableRate: number;
}

export type AllocationBasis = 'placed' | 'delivered';

export interface AllocationSettings {
  includeFixedCosts: boolean;
  basis: AllocationBasis;
  /** Număr comenzi lunare (plasate sau livrate, în funcție de `basis`). */
  monthlyOrders: number;
}

export interface Preferences {
  daysPerMonth: number;
  defaultOrdersPerDay: number;
  /** Banda ±marjă netă considerată „aproape de break-even”. */
  nearBreakEvenThreshold: number;
  /** Statusurile de produs incluse în proiecțiile lunare din Dashboard. */
  projectionStatuses: ProductStatus[];
  productsTable: {
    sortKey: string;
    sortDir: 'asc' | 'desc';
    statusFilter: ProductStatus | 'all';
    profitFilter: ProfitClass | 'all';
  };
  lastExportAt: string | null;
}

export type ProductStatus = 'idee' | 'testare' | 'activ' | 'scalare' | 'oprit';

export const PRODUCT_STATUSES: ProductStatus[] = ['idee', 'testare', 'activ', 'scalare', 'oprit'];

export type ProfitClass = 'profitable' | 'near' | 'unprofitable' | 'unknown';

/** Câmpurile care pot fi suprascrise la nivel de produs. */
export interface ProductOverrides {
  vatRate?: number | null;
  customsDutyRate?: number | null;
  shippingCost?: number | null;
  shippingFeeChargedGross?: number | null;
  fulfillmentPerOrder?: number | null;
  pickPackPerOrder?: number | null;
  packagingPerOrder?: number | null;
  inboundLogisticsPerUnit?: number | null;
  paymentProcessorPct?: number | null;
  paymentProcessorFixed?: number | null;
  codShare?: number | null;
  codFeePct?: number | null;
  codFeeFixed?: number | null;
  smsPerOrder?: number | null;
  callCenterPerOrder?: number | null;
  returnRate?: number | null;
  refusalRate?: number | null;
  failedDeliveryRate?: number | null;
  returnShippingCost?: number | null;
  returnProcessingCost?: number | null;
  unsellableRate?: number | null;
}

export type OverrideKey = keyof ProductOverrides;

export type ExtraCostBasis = 'per_unit' | 'per_order' | 'per_delivered_order';

export interface ProductExtraCost {
  id: string;
  name: string;
  basis: ExtraCostBasis;
  /** RON fără TVA. */
  amount: number;
}

export interface Product {
  id: string;
  name: string;
  supplierUrl: string;
  /** Cost unitar la furnizor, în `currency`. */
  supplierCost: number;
  currency: CurrencyCode;
  /** Curs specific produsului; `null` = se folosește cursul din setări. */
  fxRate: number | null;
  /** Dacă true, costul furnizorului include TVA deductibil și se împarte la (1 + TVA). */
  supplierCostIncludesVat: boolean;
  /** Preț de vânzare per unitate, TVA inclus. */
  sellingPriceGross: number;
  /** Cost de achiziție per comandă PLASATĂ (spend reclame / comenzi plasate). */
  cpa: number;
  unitsPerOrder: number;
  /** Comenzi plasate estimate pe zi; `null` = valoarea default din preferințe. */
  ordersPerDay: number | null;
  status: ProductStatus;
  notes: string;
  overrides: ProductOverrides;
  extraCosts: ProductExtraCost[];
  createdAt: string;
  updatedAt: string;
}

/** Ajustări aplicate unui produs în simulator. `undefined` = valoarea produsului. */
export interface ScenarioAdjustments {
  cpa?: number;
  sellingPriceGross?: number;
  /** Cost produs per unitate în RON (după conversie valutară). */
  supplierCostRon?: number;
  returnRate?: number;
  refusalRate?: number;
  shippingCost?: number;
  ordersPerDay?: number;
}

export interface Scenario {
  id: string;
  name: string;
  productId: string;
  adjustments: ScenarioAdjustments;
  createdAt: string;
}

export interface AppState {
  schemaVersion: number;
  companySettings: CompanySettings;
  taxSettings: TaxSettings;
  fx: FxSettings;
  fixedCosts: FixedCosts;
  variableCosts: VariableCosts;
  returnSettings: ReturnSettings;
  allocation: AllocationSettings;
  products: Product[];
  scenarios: Scenario[];
  preferences: Preferences;
}

/** Setările folosite de motorul de calcul (tot ce nu ține de produs). */
export type EngineSettings = Pick<
  AppState,
  'taxSettings' | 'fx' | 'fixedCosts' | 'variableCosts' | 'returnSettings' | 'allocation' | 'preferences'
>;
