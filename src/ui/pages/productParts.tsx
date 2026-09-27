import type { ProductResult } from '../../domain/engine';
import { fmtNum, fmtPct, fmtRon, fmtX } from '../../utils/format';
import { Kpi, ProfitBadge, Tip, toneOf } from '../components/ui';

/** Rezumat live folosit în formularul de produs. */
export function LiveResults({ r }: { r: ProductResult }) {
  const a = r.analysis;
  return (
    <div className="col gap-16">
      <div className="row between">
        <ProfitBadge cls={r.profitClass} />
        <span className="xs muted">
          {fmtPct(a.rates.kept, 1)} din comenzi generează venit
          <Tip>
            Refuz {fmtPct(a.rates.refusal, 1)} + nelivrare {fmtPct(a.rates.failed, 1)} din comenzile plasate; retur {fmtPct(a.rates.returnOfDelivered, 1)} din
            cele livrate.
          </Tip>
        </span>
      </div>
      <div className="grid grid-2">
        <Kpi compact label="Profit net / comandă" value={fmtRon(a.netProfit)} tone={toneOf(a.netProfit)} sub={`marjă ${fmtPct(a.netMargin)}`} />
        <Kpi compact label="Contribuție / comandă" value={fmtRon(a.contributionProfit)} tone={toneOf(a.contributionProfit)} sub={`marjă ${fmtPct(a.contributionMargin)}`} />
        <Kpi compact label="Profit / comandă livrată" value={fmtRon(a.profitPerDeliveredOrder)} tone={toneOf(a.profitPerDeliveredOrder)} />
        <Kpi compact label="Profit / lună" value={fmtRon(a.profitPerMonth, { decimals: 0 })} tone={toneOf(a.profitPerMonth)} sub={`${fmtNum(a.inputs.ordersPerDay)} comenzi/zi`} />
      </div>
      <div>
        <div className="stat-line">
          <span className="text-2">Venit fără TVA (așteptat)</span>
          <span className="v">{fmtRon(a.revenueExVat)}</span>
        </div>
        <div className="stat-line">
          <span className="text-2">Costuri variabile</span>
          <span className="v">−{fmtRon(a.variableCosts)}</span>
        </div>
        <div className="stat-line">
          <span className="text-2">Marketing (CPA)</span>
          <span className="v">−{fmtRon(a.marketing)}</span>
        </div>
        <div className="stat-line">
          <span className="text-2">Cost fix alocat</span>
          <span className="v">−{fmtRon(a.fixedAllocated)}</span>
        </div>
        <div className="stat-line" style={{ fontWeight: 600 }}>
          <span>Profit net</span>
          <span className={`v ${toneOf(a.netProfit) ?? ''}`}>{fmtRon(a.netProfit)}</span>
        </div>
      </div>
    </div>
  );
}

export function BreakEvenMini({ r }: { r: ProductResult }) {
  const be = r.analysis.breakEven;
  return (
    <div className="formula-box">
      <div className="stat-line">
        <span>Break-even CPA</span>
        <span className={`v ${be.cpaHeadroom >= 0 ? 'pos' : 'neg'}`}>{fmtRon(be.cpaNet)}</span>
      </div>
      <div className="stat-line">
        <span>Break-even ROAS</span>
        <span className="v">{fmtX(be.roasGross)}</span>
      </div>
      <div className="stat-line">
        <span>CPA max. pentru marjă 20%</span>
        <span className="v">{be.maxCpaForMargin.find((m) => m.margin === 0.2)?.value != null ? fmtRon(be.maxCpaForMargin.find((m) => m.margin === 0.2)!.value) : 'imposibil'}</span>
      </div>
      <div className="stat-line">
        <span>Preț minim (break-even)</span>
        <span className="v">{be.minPriceBreakEven === null ? 'imposibil' : fmtRon(be.minPriceBreakEven)}</span>
      </div>
    </div>
  );
}
