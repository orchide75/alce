import { useMemo } from 'react';
import { calculateProduct, type ProductResult } from '../../domain/engine';
import { useAppState } from '../../state/store';
import { href, navigate, useRoute } from '../../state/router';
import { fmtPct, fmtRon, fmtX } from '../../utils/format';
import { Card, ProfitBadge, StatusBadge, Tip, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { SERIES } from '../components/charts';

interface Metric {
  label: string;
  tip?: string;
  get: (r: ProductResult) => number | null;
  fmt: (v: number | null) => string;
  /** Direcția „mai bine”: sus sau jos. `null` = neutru (fără evidențiere). */
  better: 'high' | 'low' | null;
}

const METRICS: Metric[] = [
  { label: 'Preț vânzare (TVA inclus)', get: (r) => r.analysis.inputs.sellingPriceGross, fmt: (v) => fmtRon(v), better: null },
  { label: 'Venit fără TVA / comandă', tip: 'Așteptat, după refuzuri și retururi', get: (r) => r.analysis.revenueExVat, fmt: (v) => fmtRon(v), better: null },
  { label: 'COGS % din venit', tip: 'COGS al comenzilor păstrate / venit fără TVA', get: (r) => r.analysis.cogsPercentOfRevenue, fmt: (v) => fmtPct(v), better: 'low' },
  { label: 'Cost landed / unitate', get: (r) => r.analysis.unit.landedCost, fmt: (v) => fmtRon(v), better: null },
  { label: 'CPA', get: (r) => r.analysis.inputs.cpa, fmt: (v) => fmtRon(v), better: null },
  { label: 'Break-even CPA', get: (r) => r.analysis.breakEven.cpaNet, fmt: (v) => fmtRon(v), better: 'high' },
  { label: 'Spațiu CPA (BE − curent)', tip: 'Cât mai poate crește CPA-ul până la break-even', get: (r) => r.analysis.breakEven.cpaHeadroom, fmt: (v) => fmtRon(v), better: 'high' },
  { label: 'Break-even ROAS', get: (r) => r.analysis.breakEven.roasGross, fmt: (v) => fmtX(v), better: 'low' },
  { label: 'Marjă de contribuție', get: (r) => r.analysis.contributionMargin, fmt: (v) => fmtPct(v), better: 'high' },
  { label: 'Marjă netă', get: (r) => r.analysis.netMargin, fmt: (v) => fmtPct(v), better: 'high' },
  { label: 'Contribuție / comandă', get: (r) => r.analysis.contributionProfit, fmt: (v) => fmtRon(v), better: 'high' },
  { label: 'Profit net / comandă plasată', get: (r) => r.analysis.netProfit, fmt: (v) => fmtRon(v), better: 'high' },
  { label: 'Profit net / comandă livrată', get: (r) => r.analysis.profitPerDeliveredOrder, fmt: (v) => fmtRon(v), better: 'high' },
  { label: 'Rată păstrare comenzi', tip: 'Comenzi livrate și nereturnate / comenzi plasate', get: (r) => r.analysis.rates.kept, fmt: (v) => fmtPct(v), better: 'high' },
  { label: 'Comenzi / zi', get: (r) => r.analysis.inputs.ordersPerDay, fmt: (v) => (v === null ? '—' : String(Math.round(v * 100) / 100).replace('.', ',')), better: null },
  { label: 'Profit net lunar proiectat', get: (r) => r.analysis.profitPerMonth, fmt: (v) => fmtRon(v, { decimals: 0 }), better: 'high' },
];

export function ComparePage() {
  const state = useAppState();
  const route = useRoute();
  const ids = (route.query.get('ids') ?? '').split(',').filter((id) => state.products.some((p) => p.id === id)).slice(0, 5);
  const results = useMemo(() => ids.map((id) => calculateProduct(state.products.find((p) => p.id === id)!, state)), [ids.join(','), state]); // eslint-disable-line react-hooks/exhaustive-deps

  const setIds = (next: string[]) => navigate(`/comparatie?ids=${next.join(',')}`);
  const toggle = (id: string) => {
    if (ids.includes(id)) setIds(ids.filter((x) => x !== id));
    else if (ids.length >= 5) toast('Maxim 5 produse în comparație.', 'info');
    else setIds([...ids, id]);
  };

  if (state.products.length < 2) {
    return (
      <Card>
        <div className="empty">
          <h3>Ai nevoie de cel puțin 2 produse</h3>
          <a className="btn primary mt-16" href={href('/produse/nou')}>
            <Icon name="plus" /> Adaugă produs
          </a>
        </div>
      </Card>
    );
  }

  return (
    <div className="col gap-16">
      <Card title="Selectează 2–5 produse" sub={`${ids.length} selectate`}>
        <div className="row wrap" style={{ gap: 6 }}>
          {state.products.map((p) => {
            const on = ids.includes(p.id);
            const idx = ids.indexOf(p.id);
            return (
              <button key={p.id} className={`btn sm ${on ? '' : 'ghost'}`} onClick={() => toggle(p.id)} style={on ? { borderColor: SERIES[idx] } : undefined}>
                {on && <span className="sw" style={{ width: 8, height: 8, borderRadius: 2, background: SERIES[idx], display: 'inline-block' }} />}
                {p.name || 'Fără nume'}
              </button>
            );
          })}
        </div>
      </Card>

      {results.length < 2 ? (
        <div className="muted small">Selectează cel puțin 2 produse pentru comparație.</div>
      ) : (
        <Card title="Comparație" sub="Valoarea cea mai bună pe fiecare rând este evidențiată; rândurile fără direcție clară (preț, CPA) nu sunt evaluate." tight>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Metrică</th>
                  {results.map((r, i) => (
                    <th key={r.product.id} className="n" style={{ minWidth: 150 }}>
                      <a href={href(`/produse/${r.product.id}`)} style={{ color: 'var(--text)' }}>
                        <span className="sw" style={{ width: 8, height: 8, borderRadius: 2, background: SERIES[i], display: 'inline-block', marginRight: 6 }} />
                        {r.product.name || 'Fără nume'}
                      </a>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="muted">Status / profitabilitate</td>
                  {results.map((r) => (
                    <td key={r.product.id} className="n">
                      <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                        <StatusBadge status={r.product.status} />
                        <ProfitBadge cls={r.profitClass} />
                      </div>
                    </td>
                  ))}
                </tr>
                {METRICS.map((m) => {
                  const vals = results.map((r) => m.get(r));
                  const valid = vals.filter((v): v is number => v !== null);
                  const best = m.better && valid.length > 1 ? (m.better === 'high' ? Math.max(...valid) : Math.min(...valid)) : null;
                  const maxAbs = Math.max(1e-9, ...valid.map(Math.abs));
                  return (
                    <tr key={m.label}>
                      <td>
                        {m.label} {m.tip && <Tip>{m.tip}</Tip>}
                      </td>
                      {vals.map((v, i) => {
                        const isBest = best !== null && v === best && valid.some((x) => x !== best);
                        return (
                          <td key={i} className="n" style={isBest ? { background: 'var(--pos-soft)' } : undefined}>
                            <div className={v !== null && v < 0 ? 'neg' : ''} style={{ fontWeight: isBest ? 600 : 400 }}>
                              {m.fmt(v)}
                            </div>
                            {v !== null && (
                              <div className="bar-track" style={{ marginTop: 5, marginLeft: 'auto', width: '100%' }}>
                                <div className="bar-fill" style={{ width: `${(Math.abs(v) / maxAbs) * 100}%`, background: v < 0 ? 'var(--neg)' : SERIES[i], marginLeft: 0 }} />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
