/**
 * MOTORUL DE CALCUL – singura sursă de adevăr pentru toate formulele financiare.
 *
 * Unitatea de bază este COMANDA PLASATĂ: toate liniile de cost/venit sunt
 * valori AȘTEPTATE per comandă plasată (ponderate cu probabilitățile de
 * refuz / nelivrare / retur). Metricile per comandă livrată, per zi, per lună
 * sunt derivate din acestea.
 *
 * Fluxul unei comenzi plasate:
 *   plasată ─┬─ refuzată la livrare            (refusalRate)
 *            ├─ nelivrată (adresă, client lipsă) (failedDeliveryRate)
 *            └─ livrată (deliveredShare) ─┬─ returnată de client (returnRate din livrate)
 *                                         └─ păstrată (keptShare) → singura care generează venit
 */
import type { EngineInputs } from './inputs';
import { nonNeg, rate } from './math';
import { fmtNum, fmtPct, fmtRon } from '../../utils/format';

export type LineGroup =
  | 'produs'
  | 'logistică'
  | 'plăți'
  | 'suport'
  | 'retururi'
  | 'taxe'
  | 'alte'
  | 'marketing'
  | 'fix';

export interface CostLine {
  key: string;
  label: string;
  group: LineGroup;
  /** Cost așteptat per comandă plasată (RON, fără TVA). */
  amount: number;
  /** Formula cu valorile efective, pentru verificare. */
  formula: string;
}

export interface CoreResult {
  inputs: EngineInputs;
  rates: {
    refusal: number;
    failed: number;
    /** Ponderea comenzilor plasate care sunt livrate (acceptate de client). */
    delivered: number;
    /** Rata de retur din comenzile livrate. */
    returnOfDelivered: number;
    /** Ponderea comenzilor plasate care sunt returnate după livrare. */
    returned: number;
    /** Ponderea comenzilor plasate care rămân vândute (generează venit). */
    kept: number;
    /** Ponderea comenzilor plasate al căror colet se întoarce (refuz + nelivrat + retur). */
    comingBack: number;
  };
  unit: {
    netPrice: number;
    vatPerUnit: number;
    supplierCostRon: number;
    inbound: number;
    customs: number;
    landedCost: number;
  };
  order: {
    units: number;
    /** Valoarea comenzii cu TVA (produse + taxă livrare încasată). */
    grossValue: number;
    netValue: number;
    vatValue: number;
    netShippingFee: number;
  };
  /** Cost per colet întors (transport retur + procesare + marfă nerevandabilă). */
  costPerReturnedParcel: number;

  revenueExVat: number;
  vatCollected: number;
  grossCollected: number;

  lines: CostLine[];
  /** Suma costurilor variabile, fără marketing și fără costuri fixe. */
  variableCosts: number;
  /** Venit – costuri variabile (înainte de marketing). = Break-even CPA de contribuție. */
  contributionBeforeMarketing: number;
  marketing: number;
  contributionProfit: number;
  fixedAllocated: number;
  netProfit: number;
}

export function computeCore(i: EngineInputs): CoreResult {
  const U = i.unitsPerOrder > 0 ? i.unitsPerOrder : 1;
  const vat = rate(i.vatRate);

  // --- Probabilități flux comandă ---
  const refusal = rate(i.refusalRate);
  const failed = Math.min(rate(i.failedDeliveryRate), 1 - refusal);
  const delivered = Math.max(0, 1 - refusal - failed);
  const returnOfDelivered = rate(i.returnRate);
  const returned = delivered * returnOfDelivered;
  const kept = delivered - returned;
  const comingBack = refusal + failed + returned;

  // --- TVA: Net = Brut / (1 + TVA); TVA = Brut − Net ---
  const priceGross = nonNeg(i.sellingPriceGross);
  const netPrice = priceGross / (1 + vat);
  const vatPerUnit = priceGross - netPrice;
  const feeGross = nonNeg(i.shippingFeeChargedGross);
  const netShippingFee = feeGross / (1 + vat);

  const grossValue = priceGross * U + feeGross;
  const netValue = netPrice * U + netShippingFee;
  const vatValue = grossValue - netValue;

  // --- Cost unitar landed ---
  const supplierCostRon = nonNeg(i.supplierCostRon);
  const inbound = nonNeg(i.inboundLogisticsPerUnit);
  const customs = rate(i.customsDutyRate) * (supplierCostRon + inbound);
  const landedCost = supplierCostRon + inbound + customs;

  // --- Venit (doar comenzile păstrate) ---
  const revenueExVat = kept * netValue;
  const vatCollected = kept * vatValue;
  const grossCollected = kept * grossValue;

  const lines: CostLine[] = [];
  const add = (key: string, label: string, group: LineGroup, amount: number, formula: string) => {
    lines.push({ key, label, group, amount: Number.isFinite(amount) ? amount : 0, formula });
  };

  const keptTxt = `${fmtPct(kept, 2)} păstrate`;

  // Produs (doar unitățile efectiv vândute; marfa întoarsă se recuperează,
  // cu excepția celei nerevandabile – inclusă în costurile de retur/refuz).
  add('cogs', 'COGS (cost produs)', 'produs', kept * U * supplierCostRon,
    `${keptTxt} × ${fmtNum(U)} buc × ${fmtRon(supplierCostRon)}`);
  add('inbound', 'Logistică inbound', 'produs', kept * U * inbound,
    `${keptTxt} × ${fmtNum(U)} buc × ${fmtRon(inbound)}`);
  add('customs', 'Taxă vamală', 'produs', kept * U * customs,
    `${keptTxt} × ${fmtNum(U)} buc × ${fmtPct(i.customsDutyRate, 2)} × (${fmtRon(supplierCostRon)} + ${fmtRon(inbound)})`);

  // Logistică outbound – se plătește pentru fiecare comandă expediată.
  add('packaging', 'Ambalare (packaging)', 'logistică', nonNeg(i.packagingPerOrder),
    `${fmtRon(i.packagingPerOrder)} × fiecare comandă expediată`);
  add('fulfillment', 'Fulfillment', 'logistică', nonNeg(i.fulfillmentPerOrder),
    `${fmtRon(i.fulfillmentPerOrder)} × fiecare comandă expediată`);
  add('pickPack', 'Pick & pack', 'logistică', nonNeg(i.pickPackPerOrder),
    `${fmtRon(i.pickPackPerOrder)} × fiecare comandă expediată`);
  add('shipping', 'Transport către client', 'logistică', nonNeg(i.shippingCost),
    `${fmtRon(i.shippingCost)} × fiecare comandă expediată (inclusiv cele refuzate/returnate)`);

  // Plăți
  const cardShare = 1 - rate(i.codShare);
  const codShare = rate(i.codShare);
  add('payment', 'Procesare plăți (card)', 'plăți',
    cardShare * (rate(i.paymentProcessorPct) * grossValue + nonNeg(i.paymentProcessorFixed)),
    `${fmtPct(cardShare, 1)} comenzi card × (${fmtPct(i.paymentProcessorPct, 2)} × ${fmtRon(grossValue)} + ${fmtRon(i.paymentProcessorFixed)})`);
  add('cod', 'Comision ramburs (COD)', 'plăți',
    codShare * delivered * (rate(i.codFeePct) * grossValue + nonNeg(i.codFeeFixed)),
    `${fmtPct(codShare, 1)} ramburs × ${fmtPct(delivered, 2)} livrate × (${fmtPct(i.codFeePct, 2)} × ${fmtRon(grossValue)} + ${fmtRon(i.codFeeFixed)})`);

  // Suport clienți
  add('callCenter', 'Call center per comandă', 'suport', nonNeg(i.callCenterPerOrder),
    `${fmtRon(i.callCenterPerOrder)} × fiecare comandă plasată`);
  add('sms', 'SMS', 'suport', nonNeg(i.smsPerOrder), `${fmtRon(i.smsPerOrder)} × fiecare comandă plasată`);

  // Retururi / refuzuri / nelivrate
  const returnShip = nonNeg(i.returnShippingCost);
  const returnProc = nonNeg(i.returnProcessingCost);
  const unsellable = rate(i.unsellableRate);
  const lostGoods = unsellable * U * landedCost;
  const costPerReturnedParcel = returnShip + returnProc + lostGoods;
  const parcelTxt = `(${fmtRon(returnShip)} transport retur + ${fmtRon(returnProc)} procesare + ${fmtPct(unsellable, 1)} nerevandabil × ${fmtNum(U)} buc × ${fmtRon(landedCost)} cost landed)`;
  add('returns', 'Cost retururi (așteptat)', 'retururi', returned * costPerReturnedParcel,
    `${fmtPct(delivered, 2)} livrate × ${fmtPct(returnOfDelivered, 2)} retur × ${parcelTxt}`);
  add('refusals', 'Cost refuzuri (așteptat)', 'retururi', refusal * costPerReturnedParcel,
    `${fmtPct(refusal, 2)} refuz × ${parcelTxt}`);
  add('failed', 'Cost livrări eșuate (așteptat)', 'retururi', failed * costPerReturnedParcel,
    `${fmtPct(failed, 2)} nelivrate × ${parcelTxt}`);

  // Alte costuri variabile din setări
  for (const o of i.otherVariable) {
    const v = nonNeg(o.value);
    if (o.basis === 'per_order') add(`ov_${o.id}`, o.name || 'Alt cost variabil', 'alte', v, `${fmtRon(v)} × fiecare comandă plasată`);
    else if (o.basis === 'per_unit') add(`ov_${o.id}`, o.name || 'Alt cost variabil', 'alte', v * U, `${fmtRon(v)} × ${fmtNum(U)} buc`);
    else add(`ov_${o.id}`, o.name || 'Alt cost variabil', 'alte', rate(v) * revenueExVat, `${fmtPct(v, 2)} × venit fără TVA ${fmtRon(revenueExVat)}`);
  }

  // Costuri specifice produsului
  for (const e of i.extraCosts) {
    const v = nonNeg(e.amount);
    const label = e.name || 'Cost specific produs';
    if (e.basis === 'per_unit') add(`ex_${e.id}`, label, 'alte', v * U, `${fmtRon(v)} × ${fmtNum(U)} buc × fiecare comandă plasată`);
    else if (e.basis === 'per_order') add(`ex_${e.id}`, label, 'alte', v, `${fmtRon(v)} × fiecare comandă plasată`);
    else add(`ex_${e.id}`, label, 'alte', delivered * v, `${fmtRon(v)} × ${fmtPct(delivered, 2)} livrate`);
  }

  // Alte taxe
  for (const t of i.otherTaxes) {
    const v = nonNeg(t.value);
    if (t.basis === 'revenue_pct') add(`tax_${t.id}`, t.name || 'Taxă', 'taxe', rate(v) * revenueExVat, `${fmtPct(v, 2)} × venit fără TVA ${fmtRon(revenueExVat)}`);
    else add(`tax_${t.id}`, t.name || 'Taxă', 'taxe', v, `${fmtRon(v)} × fiecare comandă plasată`);
  }

  let variableCosts = 0;
  for (const l of lines) variableCosts += l.amount;

  const contributionBeforeMarketing = revenueExVat - variableCosts;
  const marketing = nonNeg(i.cpa);
  const contributionProfit = contributionBeforeMarketing - marketing;

  const fixedAllocated = i.includeFixedCosts
    ? i.allocationBasis === 'placed'
      ? nonNeg(i.fixedCostPerBasisOrder)
      : nonNeg(i.fixedCostPerBasisOrder) * delivered
    : 0;
  const netProfit = contributionProfit - fixedAllocated;

  return {
    inputs: i,
    rates: { refusal, failed, delivered, returnOfDelivered, returned, kept, comingBack },
    unit: { netPrice, vatPerUnit, supplierCostRon, inbound, customs, landedCost },
    order: { units: U, grossValue, netValue, vatValue, netShippingFee },
    costPerReturnedParcel,
    revenueExVat,
    vatCollected,
    grossCollected,
    lines,
    variableCosts,
    contributionBeforeMarketing,
    marketing,
    contributionProfit,
    fixedAllocated,
    netProfit,
  };
}
