import { useMemo } from 'react';
import { summarize, fixedCostPerOrder } from '../../domain/engine';
import { useAppState } from '../../state/store';
import { href, navigate } from '../../state/router';
import { fmtNum, fmtPct, fmtRon, fmtRonCompact } from '../../utils/format';
import { Alert, Card, Kpi, ProfitBadge, StatusBadge, toneOf } from '../components/ui';
import { HBarChart } from '../components/charts';
import { Icon } from '../components/Icon';
import { STATUS_LABEL } from '../components/ui';

export function DashboardPage() {
  const state = useAppState();
  const s = useMemo(() => summarize(state), [state]);
  const fixedPer = fixedCostPerOrder(state);
  const projectedLabel = state.preferences.projectionStatuses.map((x) => STATUS_LABEL[x]).join(', ');
  const settingsEmpty =
    state.variableCosts.shippingCost === 0 && state.fixedCosts.items.every((i) => i.monthlyAmount === 0);

  if (s.totalProducts === 0) {
    return (
      <div className="col gap-16">
        {settingsEmpty && <SetupHint />}
        <Card>
          <div className="empty">
            <h3>Niciun produs încă</h3>
            <p>Adaugă primul produs: URL furnizor, cost, preț de vânzare și CPA. Restul costurilor sunt preluate din Setări.</p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
              <a className="btn primary" href={href('/produse/nou')}>
                <Icon name="plus" /> Adaugă produs
              </a>
              <a className="btn" href={href('/setari')}>
                <Icon name="settings" /> Configurează setările
              </a>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const top = [...s.projected].sort((a, b) => b.analysis.profitPerMonth - a.analysis.profitPerMonth);
  const perOrder = [...s.results].sort((a, b) => b.analysis.netProfit - a.analysis.netProfit).slice(0, 12);

  return (
    <div className="col gap-16">
      {settingsEmpty && <SetupHint />}

      <div className="grid grid-4">
        <Kpi
          accent
          size="lg"
          label="Profit net lunar proiectat"
          value={fmtRonCompact(s.monthlyNetAllocated)}
          tone={toneOf(s.monthlyNetAllocated)}
          sub={`${s.projected.length} produse în proiecție (${projectedLabel})`}
          tip={
            <>
              Σ (profit net per comandă × comenzi/zi × zile) pentru produsele cu status {projectedLabel}. Include costurile fixe ALOCATE per comandă.
            </>
          }
        />
        <Kpi
          size="lg"
          label="Contribuție lunară proiectată"
          value={fmtRonCompact(s.monthlyContribution)}
          tone={toneOf(s.monthlyContribution)}
          sub="înainte de costuri fixe"
          tip={<code>Σ contribuție/comandă × comenzi/lună</code>}
        />
        <Kpi
          size="lg"
          label="Venit lunar proiectat (fără TVA)"
          value={fmtRonCompact(s.monthlyRevenue)}
          sub={`${fmtNum(s.monthlyOrders, 0)} comenzi plasate/lună · ads ${fmtRonCompact(s.monthlyAdSpend)}`}
          tip={<code>Σ venit fără TVA/comandă plasată × comenzi/lună</code>}
        />
        <Kpi
          size="lg"
          label="Costuri fixe lunare"
          value={fmtRonCompact(s.totalMonthlyFixedCosts)}
          sub={fixedPer !== null ? `${fmtRon(fixedPer)} / comandă ${state.allocation.basis === 'placed' ? 'plasată' : 'livrată'}` : 'comenzi lunare neconfigurate'}
          tip={<>Total costuri fixe active din Setări. Alocare: total / {fmtNum(state.allocation.monthlyOrders)} comenzi {state.allocation.basis === 'placed' ? 'plasate' : 'livrate'} pe lună.</>}
        />
      </div>

      <div className="grid grid-5">
        <Kpi compact label="Total produse" value={fmtNum(s.totalProducts)} sub={`${s.byClass.profitable} profitabile · ${s.byClass.unprofitable} neprofitabile`} />
        <Kpi
          compact
          label="Marjă netă medie"
          value={fmtPct(s.averageNetMargin)}
          tone={toneOf(s.averageNetMargin)}
          sub={`contribuție medie ${fmtPct(s.averageContributionMargin)}`}
          tip="Media simplă a marjelor nete ale tuturor produselor (fiecare produs cântărește egal)."
        />
        <Kpi compact label="CPA mediu" value={fmtRon(s.averageCpa)} tip="Media simplă a CPA-urilor introduse pe produse." />
        <Kpi compact label="Break-even CPA mediu" value={fmtRon(s.averageBreakEvenCpa)} tip="Media simplă a CPA-urilor de break-even (net, cu costuri fixe alocate)." />
        <Kpi
          compact
          label="Cea mai bună marjă de contribuție"
          value={s.bestContribution ? fmtPct(s.bestContribution.margin) : '—'}
          tone={s.bestContribution ? toneOf(s.bestContribution.margin) : null}
          sub={s.bestContribution ? <a href={href(`/produse/${s.bestContribution.result.product.id}`)}>{s.bestContribution.result.product.name || 'Fără nume'}</a> : undefined}
        />
      </div>

      <Card
        title="Reconciliere P&L lunar"
        sub="Cum ajungi de la contribuție la profitul real al firmei"
      >
        <div className="grid grid-2">
          <div>
            <div className="stat-line">
              <span>Contribuție lunară (produse în proiecție)</span>
              <span className={`v ${toneOf(s.monthlyContribution) ?? ''}`}>{fmtRon(s.monthlyContribution, { decimals: 0 })}</span>
            </div>
            <div className="stat-line">
              <span>− Costuri fixe lunare totale</span>
              <span className="v">{fmtRon(-s.totalMonthlyFixedCosts, { decimals: 0 })}</span>
            </div>
            <div className="stat-line" style={{ fontWeight: 600 }}>
              <span>= Profit net real al firmei</span>
              <span className={`v ${toneOf(s.monthlyNetReal) ?? ''}`}>{fmtRon(s.monthlyNetReal, { decimals: 0 })}</span>
            </div>
          </div>
          <div className="small text-2">
            <p style={{ marginTop: 0 }}>
              <b>Profit net lunar proiectat</b> ({fmtRon(s.monthlyNetAllocated, { decimals: 0 })}) folosește costul fix <i>alocat per comandă</i>, pe baza a{' '}
              {fmtNum(state.allocation.monthlyOrders)} comenzi/lună din Setări.
            </p>
            <p style={{ marginBottom: 0 }}>
              <b>Profitul net real</b> scade costurile fixe integral. Cele două coincid doar când volumul proiectat al produselor (
              {state.allocation.basis === 'placed'
                ? `${fmtNum(s.monthlyOrders, 0)} comenzi plasate`
                : `${fmtNum(s.monthlyDeliveredOrders, 0)} comenzi livrate`}
              /lună) este egal cu volumul folosit pentru alocare ({fmtNum(state.allocation.monthlyOrders, 0)}) și produsele în proiecție reprezintă tot magazinul.
            </p>
          </div>
        </div>
      </Card>

      <div className="split-wide">
        <Card title="Profit net lunar proiectat pe produs" sub={`Produse cu status ${projectedLabel}`}>
          {top.length ? (
            <HBarChart
              items={top.map((r) => ({
                key: r.product.id,
                label: r.product.name || 'Fără nume',
                value: r.analysis.profitPerMonth,
                onClick: () => navigate(`/produse/${r.product.id}`),
                tooltip: (
                  <>
                    <b>{r.product.name || 'Fără nume'}</b>
                    <div>Profit net/lună: {fmtRon(r.analysis.profitPerMonth, { decimals: 0 })}</div>
                    <div>
                      {fmtRon(r.analysis.netProfit)} × {fmtNum(r.analysis.monthlyOrders, 0)} comenzi/lună
                    </div>
                  </>
                ),
              }))}
            />
          ) : (
            <div className="muted small">Niciun produs cu status {projectedLabel}. Schimbă statusul produselor pentru a le include în proiecții.</div>
          )}
        </Card>
        <Card title="Profit net per comandă plasată" sub="Toate produsele">
          <HBarChart
            format={(v) => fmtRon(v)}
            items={perOrder.map((r) => ({
              key: r.product.id,
              label: r.product.name || 'Fără nume',
              value: r.analysis.netProfit,
              display: `${fmtRon(r.analysis.netProfit)}`,
              onClick: () => navigate(`/produse/${r.product.id}`),
            }))}
          />
        </Card>
      </div>

      <Card
        title="Produse"
        sub="Sortate după profit net lunar"
        tight
        actions={
          <a className="btn sm" href={href('/produse')}>
            Toate produsele
          </a>
        }
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Produs</th>
                <th>Status</th>
                <th className="n">Preț</th>
                <th className="n">CPA</th>
                <th className="n">BE CPA</th>
                <th className="n">Profit/comandă</th>
                <th className="n">Marjă netă</th>
                <th className="n">Profit/lună</th>
                <th>Profitabilitate</th>
              </tr>
            </thead>
            <tbody>
              {[...s.results]
                .sort((a, b) => b.analysis.profitPerMonth - a.analysis.profitPerMonth)
                .slice(0, 10)
                .map((r) => (
                  <tr key={r.product.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/produse/${r.product.id}`)}>
                    <td style={{ maxWidth: 260 }} className="ellipsis">
                      {r.product.name || 'Fără nume'}
                    </td>
                    <td>
                      <StatusBadge status={r.product.status} />
                    </td>
                    <td className="n">{fmtRon(r.product.sellingPriceGross)}</td>
                    <td className="n">{fmtRon(r.analysis.inputs.cpa)}</td>
                    <td className="n">{fmtRon(r.analysis.breakEven.cpaNet)}</td>
                    <td className={`n ${toneOf(r.analysis.netProfit) ?? ''}`}>{fmtRon(r.analysis.netProfit)}</td>
                    <td className={`n ${toneOf(r.analysis.netMargin) ?? ''}`}>{fmtPct(r.analysis.netMargin)}</td>
                    <td className={`n ${toneOf(r.analysis.profitPerMonth) ?? ''}`}>{fmtRon(r.analysis.profitPerMonth, { decimals: 0 })}</td>
                    <td>
                      <ProfitBadge cls={r.profitClass} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SetupHint() {
  return (
    <Alert level="info">
      Setările companiei par necompletate (transport 0, costuri fixe 0). Rezultatele vor fi supraestimate până completezi{' '}
      <a href={href('/setari')}>Setări companie</a>. Aplicația nu inventează costuri: orice valoare lipsă este tratată ca 0 și marcată ca atare.
    </Alert>
  );
}
