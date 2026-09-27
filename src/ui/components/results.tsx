/**
 * Panouri de rezultate reutilizate în Adăugare produs, Detalii produs și
 * Simulator – toate afișează direct ieșirea motorului de calcul.
 */
import type { ReactNode } from 'react';
import type { Analysis, CostLine, LineGroup, ProductResult, SensitivityRow } from '../../domain/engine';
import { PROFIT_CLASS_LABEL } from '../../domain/engine';
import { fmtNum, fmtPct, fmtRon, fmtX } from '../../utils/format';
import { Kpi, SourceTag, Tip, toneOf } from './ui';
import { SERIES, StackBar } from './charts';

/* ---------------- KPI principale ---------------- */

export function HeadlineKpis({ r, compact }: { r: ProductResult; compact?: boolean }) {
  const a = r.analysis;
  return (
    <div className={`grid ${compact ? 'grid-2' : 'grid-4'}`}>
      <Kpi
        compact={compact}
        label="Profit net / comandă plasată"
        value={fmtRon(a.netProfit)}
        tone={toneOf(a.netProfit)}
        sub={`Marjă netă ${fmtPct(a.netMargin)}`}
        tip={
          <>
            <code>Profit net = Contribuție − Cost fix alocat</code>
            <br />= {fmtRon(a.contributionProfit)} − {fmtRon(a.fixedAllocated)}
            <br />
            <code>Marjă netă = Profit net / Venit fără TVA</code>
          </>
        }
      />
      <Kpi
        compact={compact}
        label="Contribuție / comandă"
        value={fmtRon(a.contributionProfit)}
        tone={toneOf(a.contributionProfit)}
        sub={`Marjă contribuție ${fmtPct(a.contributionMargin)}`}
        tip={
          <>
            <code>Contribuție = Venit fără TVA − Costuri variabile − CPA</code>
            <br />= {fmtRon(a.revenueExVat)} − {fmtRon(a.variableCosts)} − {fmtRon(a.marketing)}
          </>
        }
      />
      <Kpi
        compact={compact}
        label="Break-even CPA"
        value={fmtRon(a.breakEven.cpaNet)}
        tone={a.breakEven.cpaHeadroom >= 0 ? 'pos' : 'neg'}
        sub={
          a.breakEven.cpaHeadroom >= 0
            ? `Spațiu CPA: +${fmtRon(a.breakEven.cpaHeadroom)}`
            : `CPA peste break-even cu ${fmtRon(-a.breakEven.cpaHeadroom)}`
        }
        tip={
          <>
            CPA maxim la care profitul net este 0.
            <br />
            <code>BE CPA = Venit − Costuri variabile − Cost fix alocat</code>
            <br />= {fmtRon(a.revenueExVat)} − {fmtRon(a.variableCosts)} − {fmtRon(a.fixedAllocated)}
          </>
        }
      />
      <Kpi
        compact={compact}
        label="Profit net / lună"
        value={fmtRon(a.profitPerMonth, { decimals: 0 })}
        tone={toneOf(a.profitPerMonth)}
        sub={`${fmtNum(a.inputs.ordersPerDay)} comenzi/zi × ${fmtNum(a.inputs.daysPerMonth)} zile`}
        tip={
          <>
            <code>Profit/lună = Profit net/comandă × comenzi/zi × zile/lună</code>
            <br />= {fmtRon(a.netProfit)} × {fmtNum(a.inputs.ordersPerDay)} × {fmtNum(a.inputs.daysPerMonth)}
          </>
        }
      />
    </div>
  );
}

/* ---------------- Compoziția venitului ---------------- */

const GROUP_FOLD: Record<LineGroup, { key: string; label: string; color: string }> = {
  produs: { key: 'produs', label: 'Produs (COGS, inbound, vamă)', color: SERIES[0] },
  logistică: { key: 'logistica', label: 'Logistică & livrare', color: SERIES[1] },
  plăți: { key: 'plati', label: 'Plăți & ramburs', color: SERIES[2] },
  retururi: { key: 'retururi', label: 'Retururi & refuzuri', color: SERIES[3] },
  marketing: { key: 'marketing', label: 'Marketing (CPA)', color: SERIES[4] },
  fix: { key: 'fix', label: 'Costuri fixe alocate', color: SERIES[5] },
  suport: { key: 'altele', label: 'Suport, taxe, alte', color: SERIES[7] },
  taxe: { key: 'altele', label: 'Suport, taxe, alte', color: SERIES[7] },
  alte: { key: 'altele', label: 'Suport, taxe, alte', color: SERIES[7] },
};

export function RevenueComposition({ a }: { a: Analysis }) {
  const map = new Map<string, { key: string; label: string; color: string; value: number }>();
  const addTo = (g: LineGroup, v: number) => {
    const f = GROUP_FOLD[g];
    const cur = map.get(f.key) ?? { ...f, value: 0 };
    cur.value += v;
    map.set(f.key, cur);
  };
  a.lines.forEach((l) => addTo(l.group, l.amount));
  addTo('marketing', a.marketing);
  addTo('fix', a.fixedAllocated);
  const segs = [...map.values()].filter((s) => s.value > 0.0001);
  segs.push({ key: 'profit', label: a.netProfit >= 0 ? 'Profit net' : 'Pierdere netă', color: a.netProfit >= 0 ? 'var(--pos)' : 'var(--neg)', value: a.netProfit >= 0 ? a.netProfit : 0 });
  return (
    <div>
      <StackBar segments={segs} total={a.revenueExVat} />
      {a.netProfit < 0 && (
        <div className="small neg mt-8">
          Costurile depășesc venitul cu {fmtRon(-a.netProfit)} per comandă plasată.
        </div>
      )}
    </div>
  );
}

/* ---------------- Calculation breakdown ---------------- */

function Row({
  label,
  value,
  delivered,
  pct,
  formula,
  cls,
  tone,
}: {
  label: ReactNode;
  value: number;
  delivered: number;
  pct: number | null;
  formula?: ReactNode;
  cls?: string;
  tone?: boolean;
}) {
  const t = tone ? toneOf(value) : null;
  return (
    <tr className={cls}>
      <td>
        <div>{label}</div>
        {formula && <div className="formula">{formula}</div>}
      </td>
      <td className={`n ${t ?? ''}`}>{fmtRon(value)}</td>
      <td className={`n ${t ?? ''}`}>{fmtRon(delivered)}</td>
      <td className="n muted">{fmtPct(pct)}</td>
    </tr>
  );
}

export function CalculationBreakdown({ r }: { r: ProductResult }) {
  const a = r.analysis;
  const R = a.revenueExVat;
  const d = a.rates.delivered;
  const perDel = (v: number) => (d > 0 ? v / d : 0);
  const pct = (v: number) => (R > 0 ? v / R : null);
  const lines = a.lines;
  const byGroup = (g: LineGroup[]) => lines.filter((l) => g.includes(l.group));
  const groups: { title: string; items: CostLine[] }[] = [
    { title: 'Cost produs', items: byGroup(['produs']) },
    { title: 'Logistică outbound', items: byGroup(['logistică']) },
    { title: 'Plăți', items: byGroup(['plăți']) },
    { title: 'Customer support', items: byGroup(['suport']) },
    { title: 'Retururi, refuzuri, livrări eșuate', items: byGroup(['retururi']) },
    { title: 'Alte costuri și taxe', items: byGroup(['alte', 'taxe']) },
  ].filter((g) => g.items.length);

  return (
    <div className="table-wrap">
      <table className="table compact">
        <thead>
          <tr>
            <th>Element</th>
            <th className="n">
              Per comandă plasată <Tip>Valoare așteptată per comandă plasată, ponderată cu probabilitățile de refuz, nelivrare și retur.</Tip>
            </th>
            <th className="n">
              Per comandă livrată <Tip>Valoarea per comandă plasată împărțită la rata de livrare ({fmtPct(d, 2)}).</Tip>
            </th>
            <th className="n">% din venit</th>
          </tr>
        </thead>
        <tbody>
          <Row
            label="Preț vânzare (TVA inclus) × unități + taxă livrare"
            value={a.order.grossValue}
            delivered={a.order.grossValue}
            pct={null}
            formula={`${fmtRon(a.inputs.sellingPriceGross)} × ${fmtNum(a.order.units)} buc + ${fmtRon(a.inputs.shippingFeeChargedGross)} taxă livrare — valoarea unei comenzi, nu venit așteptat`}
            cls="subtotal"
          />
          <Row
            label="TVA colectat (așteptat)"
            value={a.vatCollected}
            delivered={perDel(a.vatCollected)}
            pct={null}
            formula={`TVA = Brut − Brut / (1 + ${fmtPct(a.inputs.vatRate, 2)}) = ${fmtRon(a.order.vatValue)} per comandă păstrată × ${fmtPct(a.rates.kept, 2)} păstrate`}
          />
          <Row
            label="Venit fără TVA (așteptat)"
            value={R}
            delivered={perDel(R)}
            pct={R > 0 ? 1 : null}
            formula={`Net = Brut / (1 + TVA) = ${fmtRon(a.order.netValue)} × ${fmtPct(a.rates.kept, 2)} comenzi păstrate (livrate și nereturnate)`}
            cls="subtotal"
          />
          {groups.map((g) => (
            <GroupRows key={g.title} title={g.title} items={g.items} perDel={perDel} pct={pct} />
          ))}
          <Row label="Total costuri variabile" value={-a.variableCosts} delivered={-perDel(a.variableCosts)} pct={pct(a.variableCosts)} cls="subtotal" />
          <Row
            label="Contribuție înainte de marketing"
            value={a.contributionBeforeMarketing}
            delivered={perDel(a.contributionBeforeMarketing)}
            pct={pct(a.contributionBeforeMarketing)}
            formula="= Break-even CPA de contribuție"
            tone
          />
          <Row
            label="Marketing (CPA)"
            value={-a.marketing}
            delivered={-perDel(a.marketing)}
            pct={pct(a.marketing)}
            formula={`CPA per comandă plasată = ${fmtRon(a.marketing)}`}
          />
          <Row label="Profit de contribuție" value={a.contributionProfit} delivered={perDel(a.contributionProfit)} pct={pct(a.contributionProfit)} cls="total" tone />
          <Row
            label="Cost fix alocat"
            value={-a.fixedAllocated}
            delivered={-perDel(a.fixedAllocated)}
            pct={pct(a.fixedAllocated)}
            formula={
              !a.inputs.includeFixedCosts
                ? 'Alocarea costurilor fixe este dezactivată în Setări'
                : a.inputs.allocationBasis === 'placed'
                  ? `${fmtRon(a.inputs.totalMonthlyFixedCosts)} / ${fmtNum(a.inputs.monthlyOrdersForAllocation)} comenzi plasate/lună`
                  : `${fmtRon(a.inputs.totalMonthlyFixedCosts)} / ${fmtNum(a.inputs.monthlyOrdersForAllocation)} comenzi livrate/lună = ${fmtRon(a.inputs.fixedCostPerBasisOrder)} × ${fmtPct(d, 2)} livrate`
            }
          />
          <Row label="Profit net (fully loaded)" value={a.netProfit} delivered={perDel(a.netProfit)} pct={pct(a.netProfit)} cls="total" tone />
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  title,
  items,
  perDel,
  pct,
}: {
  title: string;
  items: CostLine[];
  perDel: (v: number) => number;
  pct: (v: number) => number | null;
}) {
  return (
    <>
      <tr>
        <td colSpan={4} className="xs muted" style={{ paddingTop: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </td>
      </tr>
      {items.map((l) => (
        <Row key={l.key} label={l.label} value={-l.amount} delivered={-perDel(l.amount)} pct={pct(l.amount)} formula={l.formula} />
      ))}
    </>
  );
}

/* ---------------- Flux comenzi ---------------- */

export function OrderFlow({ a }: { a: Analysis }) {
  const items = [
    { label: 'Păstrate (venit)', v: a.rates.kept, c: 'var(--pos)' },
    { label: 'Returnate', v: a.rates.returned, c: SERIES[3] },
    { label: 'Refuzate', v: a.rates.refusal, c: SERIES[1] },
    { label: 'Nelivrate', v: a.rates.failed, c: SERIES[6] },
  ];
  return (
    <div>
      <div className="verdict-bar">
        {items.filter((i) => i.v > 0).map((i) => (
          <div key={i.label} style={{ width: `${i.v * 100}%`, background: i.c }} title={`${i.label}: ${fmtPct(i.v, 2)}`} />
        ))}
      </div>
      <div className="legend mt-8">
        {items.map((i) => (
          <span key={i.label}>
            <span className="sw" style={{ background: i.c }} />
            {i.label} <span className="num" style={{ color: 'var(--text)' }}>{fmtPct(i.v, 1)}</span>
          </span>
        ))}
      </div>
      <div className="xs muted mt-8">
        Din 100 comenzi plasate: {fmtNum(a.rates.delivered * 100, 1)} livrate, din care {fmtNum(a.rates.returned * 100, 1)} returnate → {fmtNum(a.rates.kept * 100, 1)} generează venit.
      </div>
    </div>
  );
}

/* ---------------- Break-even ---------------- */

export function BreakEvenPanel({ r }: { r: ProductResult }) {
  const a = r.analysis;
  const be = a.breakEven;
  const cur = a.inputs.cpa;
  return (
    <div className="col gap-16">
      <div className="grid grid-3">
        <Kpi
          compact
          label="Break-even CPA (net)"
          value={fmtRon(be.cpaNet)}
          tone={be.cpaNet > 0 ? null : 'neg'}
          sub="include costuri fixe alocate"
          tip={<code>Venit − Costuri variabile − Cost fix alocat</code>}
        />
        <Kpi
          compact
          label="Break-even CPA (contribuție)"
          value={fmtRon(be.cpaContribution)}
          sub="fără costuri fixe"
          tip={<code>Venit − Costuri variabile</code>}
        />
        <Kpi
          compact
          label="Break-even ROAS"
          value={fmtX(be.roasGross)}
          sub={be.roasGross === null ? 'neprofitabil la orice CPA' : `ROAS actual ${fmtX(be.currentRoasGross)}`}
          tone={be.roasGross !== null && be.currentRoasGross !== null ? (be.currentRoasGross >= be.roasGross ? 'pos' : 'neg') : null}
          tip={
            <>
              ROAS calculat pe valoarea comenzii plasate cu TVA (cum raportează Meta/Google/TikTok):
              <br />
              <code>Valoare comandă brută / BE CPA</code> = {fmtRon(a.order.grossValue)} / {fmtRon(be.cpaNet)}
              <br />
              ROAS break-even pe venit net realizat (fără TVA, după retururi): <b>{fmtX(be.roasNet)}</b>
            </>
          }
        />
      </div>

      <div className="grid grid-2">
        <div>
          <div className="section-title">CPA maxim pentru marjă netă țintă</div>
          <table className="table compact">
            <tbody>
              {be.maxCpaForMargin.map((m) => (
                <tr key={m.margin} className={m.value !== null && cur <= m.value ? 'row-pos' : ''}>
                  <td>Marjă {fmtPct(m.margin, 0)}</td>
                  <td className="n">
                    {m.value === null ? <span className="muted">imposibil</span> : fmtRon(m.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="xs muted mt-8">
            <code>CPA max = BE CPA − marjă × venit fără TVA ({fmtRon(a.revenueExVat)})</code>. Rândurile marcate sunt atinse la CPA-ul curent.
          </div>
        </div>
        <div>
          <div className="section-title">Preț minim de vânzare (TVA inclus)</div>
          <table className="table compact">
            <tbody>
              <tr>
                <td>Break-even la CPA curent ({fmtRon(cur)})</td>
                <td className="n">{be.minPriceBreakEven === null ? <span className="muted">imposibil</span> : fmtRon(be.minPriceBreakEven)}</td>
              </tr>
              {be.minPriceForMargin.map((m) => (
                <tr key={m.margin}>
                  <td>Pentru marjă netă {fmtPct(m.margin, 0)}</td>
                  <td className="n">{m.value === null ? <span className="muted">imposibil</span> : fmtRon(m.value)}</td>
                </tr>
              ))}
              <tr>
                <td className="muted">Preț curent</td>
                <td className="n muted">{fmtRon(a.inputs.sellingPriceGross)}</td>
              </tr>
            </tbody>
          </table>
          <div className="xs muted mt-8">
            Calculat exact prin motor: venitul, comisioanele procentuale și taxele pe venit cresc liniar cu prețul; CPA și restul costurilor rămân constante.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Tabel sensibilitate ---------------- */

export function SensitivityTable({ rows }: { rows: SensitivityRow[] }) {
  return (
    <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
      <table className="table compact">
        <thead>
          <tr>
            <th className="n">CPA</th>
            <th className="n">ROAS</th>
            <th className="n">Profit net / comandă</th>
            <th className="n">Marjă netă</th>
            <th className="n">Profit lunar</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.cpa}-${r.marker}`}
              className={`${r.profitClass === 'profitable' ? 'row-pos' : r.profitClass === 'near' ? 'row-near' : r.profitClass === 'unprofitable' ? 'row-neg' : ''} ${r.marker === 'current' ? 'highlight' : ''}`}
            >
              <td className="n">
                {fmtRon(r.cpa)}
                {r.marker === 'current' && <span className="badge accent" style={{ marginLeft: 6 }}>curent</span>}
                {r.marker === 'breakeven' && <span className="badge near" style={{ marginLeft: 6 }}>break-even</span>}
              </td>
              <td className="n muted">{fmtX(r.roasGross)}</td>
              <td className={`n ${toneOf(r.profitPerOrder) ?? ''}`}>{fmtRon(r.profitPerOrder)}</td>
              <td className={`n ${toneOf(r.margin) ?? ''}`}>{fmtPct(r.margin)}</td>
              <td className={`n ${toneOf(r.monthlyProfit) ?? ''}`}>{fmtRon(r.monthlyProfit, { decimals: 0 })}</td>
              <td className="small">{PROFIT_CLASS_LABEL[r.profitClass]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Presupuneri / surse ---------------- */

const INPUT_LABELS: [keyof Analysis['inputs'], string, 'ron' | 'pct' | 'num'][] = [
  ['sellingPriceGross', 'Preț vânzare (TVA inclus)', 'ron'],
  ['supplierCostRon', 'Cost produs (RON, fără TVA)', 'ron'],
  ['unitsPerOrder', 'Unități per comandă', 'num'],
  ['cpa', 'CPA', 'ron'],
  ['ordersPerDay', 'Comenzi/zi', 'num'],
  ['vatRate', 'Cotă TVA', 'pct'],
  ['customsDutyRate', 'Taxă vamală', 'pct'],
  ['inboundLogisticsPerUnit', 'Logistică inbound / unitate', 'ron'],
  ['shippingCost', 'Transport către client', 'ron'],
  ['shippingFeeChargedGross', 'Taxă livrare încasată (TVA inclus)', 'ron'],
  ['fulfillmentPerOrder', 'Fulfillment', 'ron'],
  ['pickPackPerOrder', 'Pick & pack', 'ron'],
  ['packagingPerOrder', 'Packaging', 'ron'],
  ['paymentProcessorPct', 'Procesator plăți %', 'pct'],
  ['paymentProcessorFixed', 'Procesator plăți fix', 'ron'],
  ['codShare', 'Pondere ramburs', 'pct'],
  ['codFeePct', 'Comision ramburs %', 'pct'],
  ['codFeeFixed', 'Comision ramburs fix', 'ron'],
  ['smsPerOrder', 'SMS / comandă', 'ron'],
  ['callCenterPerOrder', 'Call center / comandă', 'ron'],
  ['returnRate', 'Rată retur (din livrate)', 'pct'],
  ['refusalRate', 'Rată refuz', 'pct'],
  ['failedDeliveryRate', 'Rată nelivrare', 'pct'],
  ['returnShippingCost', 'Transport retur / colet', 'ron'],
  ['returnProcessingCost', 'Procesare retur / colet', 'ron'],
  ['unsellableRate', 'Marfă nerevandabilă', 'pct'],
  ['daysPerMonth', 'Zile / lună', 'num'],
];

export function AssumptionsTable({ r }: { r: ProductResult }) {
  const i = r.analysis.inputs;
  const src = r.resolved.sources;
  const fx = r.resolved.fx;
  return (
    <div className="table-wrap">
      <table className="table compact">
        <thead>
          <tr>
            <th>Input</th>
            <th className="n">Valoare folosită</th>
            <th>Sursă</th>
          </tr>
        </thead>
        <tbody>
          {fx.currency !== 'RON' && (
            <tr>
              <td>
                Curs {fx.currency}/RON
                <div className="formula">
                  {fmtNum(fx.supplierCostOriginal, 4)} {fx.currency} × {fmtNum(fx.rate, 4)}
                  {r.product.supplierCostIncludesVat ? ` / (1 + TVA)` : ''} = {fmtRon(i.supplierCostRon)}
                </div>
              </td>
              <td className="n">{fmtNum(fx.rate, 4)}</td>
              <td>
                <SourceTag source={fx.source} />
              </td>
            </tr>
          )}
          {INPUT_LABELS.map(([k, label, kind]) => {
            const v = i[k] as number;
            return (
              <tr key={k}>
                <td>{label}</td>
                <td className="n">{kind === 'ron' ? fmtRon(v) : kind === 'pct' ? fmtPct(v, 2) : fmtNum(v, 2)}</td>
                <td>
                  <SourceTag source={src[k as keyof typeof src]} />
                </td>
              </tr>
            );
          })}
          <tr>
            <td>
              Cost fix per comandă ({i.allocationBasis === 'placed' ? 'plasată' : 'livrată'})
              <div className="formula">
                {i.includeFixedCosts
                  ? `${fmtRon(i.totalMonthlyFixedCosts)} / ${fmtNum(i.monthlyOrdersForAllocation)} comenzi`
                  : 'alocare dezactivată'}
              </div>
            </td>
            <td className="n">{fmtRon(i.fixedCostPerBasisOrder)}</td>
            <td>
              <SourceTag source={src.fixedCostPerBasisOrder} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
