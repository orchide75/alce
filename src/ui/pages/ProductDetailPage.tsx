import { useMemo, useState } from 'react';
import { calculateProduct, cpaSensitivity } from '../../domain/engine';
import { PRODUCT_STATUSES, type ProductStatus } from '../../domain/types';
import { useAppState } from '../../state/store';
import { deleteProduct, duplicateProduct, setProductStatus } from '../../state/actions';
import { href, navigate } from '../../state/router';
import { fmtNum, fmtPct, fmtRon, fmtDateTime } from '../../utils/format';
import { safeUrl } from '../../utils/url';
import { Icon } from '../components/Icon';
import { Card, ConfirmDialog, Kpi, ProfitBadge, STATUS_LABEL, toast, toneOf, Warnings } from '../components/ui';
import {
  AssumptionsTable,
  BreakEvenPanel,
  CalculationBreakdown,
  HeadlineKpis,
  OrderFlow,
  RevenueComposition,
  SensitivityTable,
} from '../components/results';
import { ProfitCurve } from '../components/charts';

export function ProductDetailPage({ productId }: { productId: string }) {
  const state = useAppState();
  const product = state.products.find((p) => p.id === productId);
  const [confirmDel, setConfirmDel] = useState(false);
  const r = useMemo(() => (product ? calculateProduct(product, state) : null), [product, state]);
  const rows = useMemo(() => (r ? cpaSensitivity(r.analysis.inputs, state.preferences.nearBreakEvenThreshold) : []), [r, state.preferences.nearBreakEvenThreshold]);

  if (!product || !r) {
    return (
      <Card>
        <div className="empty">
          Produsul nu există. <a href={href('/produse')}>Înapoi la produse</a>
        </div>
      </Card>
    );
  }
  const a = r.analysis;
  const url = safeUrl(product.supplierUrl);
  const scenarios = state.scenarios.filter((s) => s.productId === product.id);

  return (
    <div className="col gap-16">
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="row wrap">
            <h1 style={{ fontSize: 22 }}>{product.name || 'Fără nume'}</h1>
            <ProfitBadge cls={r.profitClass} />
          </div>
          <p className="small">
            {url ? (
              <a href={url} target="_blank" rel="noreferrer noopener">
                <Icon name="external" className="" /> {url.length > 80 ? url.slice(0, 80) + '…' : url}
              </a>
            ) : (
              <span className="muted">Fără URL furnizor</span>
            )}
            <span className="muted"> · actualizat {fmtDateTime(product.updatedAt)}</span>
          </p>
        </div>
        <div className="row wrap">
          <select
            className="input"
            style={{ width: 130 }}
            value={product.status}
            onChange={(e) => setProductStatus(product.id, e.target.value as ProductStatus)}
            aria-label="Status"
          >
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <a className="btn" href={href(`/simulator?product=${product.id}`)}>
            <Icon name="sim" /> Simulează
          </a>
          <a className="btn" href={href(`/produse/${product.id}/editare`)}>
            <Icon name="edit" /> Editează
          </a>
          <button
            className="btn"
            onClick={() => {
              const id = duplicateProduct(product.id);
              toast('Produs duplicat.');
              if (id) navigate(`/produse/${id}/editare`);
            }}
          >
            <Icon name="copy" /> Duplică
          </button>
          <button className="btn danger" onClick={() => setConfirmDel(true)}>
            <Icon name="trash" />
          </button>
        </div>
      </div>

      <Warnings warnings={r.warnings} />

      <HeadlineKpis r={r} />

      <div className="grid grid-5">
        <Kpi compact label="Venit fără TVA / comandă" value={fmtRon(a.revenueExVat)} sub={`preț net ${fmtRon(a.unit.netPrice)} / unitate`} tip={<code>Net = Brut / (1 + TVA) = {fmtRon(a.inputs.sellingPriceGross)} / {fmtNum(1 + a.inputs.vatRate, 4)}</code>} />
        <Kpi compact label="TVA per unitate" value={fmtRon(a.unit.vatPerUnit)} sub={`cotă ${fmtPct(a.inputs.vatRate, 0)}`} tip={<code>TVA = Brut − Net</code>} />
        <Kpi compact label="Cost landed / unitate" value={fmtRon(a.unit.landedCost)} sub={`COGS ${fmtPct(a.cogsPercentOfRevenue)} din venit`} tip={<code>Cost furnizor RON + inbound + vamă = {fmtRon(a.unit.supplierCostRon)} + {fmtRon(a.unit.inbound)} + {fmtRon(a.unit.customs)}</code>} />
        <Kpi compact label="Profit / comandă livrată" value={fmtRon(a.profitPerDeliveredOrder)} tone={toneOf(a.profitPerDeliveredOrder)} tip={<code>Profit net / rată livrare = {fmtRon(a.netProfit)} / {fmtPct(a.rates.delivered, 2)}</code>} />
        <Kpi compact label="Profit / 100 comenzi" value={fmtRon(a.profitPer100Orders, { decimals: 0 })} tone={toneOf(a.profitPer100Orders)} sub={`profit/zi ${fmtRon(a.profitPerDay, { decimals: 0 })}`} />
      </div>

      <div className="split-wide">
        <Card title="Unde se duce venitul" sub="Per comandă plasată, fără TVA">
          <RevenueComposition a={a} />
        </Card>
        <Card title="Fluxul comenzilor" sub="Din comenzile plasate">
          <OrderFlow a={a} />
        </Card>
      </div>

      <Card title="Calculation breakdown" sub="Fiecare valoare, cu formula și inputurile care au produs-o">
        <CalculationBreakdown r={r} />
      </Card>

      <Card title="Break-even & praguri" sub="CPA maxim, ROAS minim și preț minim">
        <BreakEvenPanel r={r} />
      </Card>

      <div className="split-wide">
        <Card title="Sensibilitate la CPA" sub="Profit net per comandă, marjă și profit lunar" tight>
          <SensitivityTable rows={rows} />
        </Card>
        <div className="col gap-16">
          <Card title="Profit net / comandă vs CPA">
            <ProfitCurve points={rows.map((x) => ({ x: x.cpa, y: x.profitPerOrder }))} currentX={a.inputs.cpa} breakEvenX={a.breakEven.cpaNet > 0 ? a.breakEven.cpaNet : null} xLabel="CPA" />
            <div className="legend mt-8">
              <span>
                <span className="sw" style={{ background: 'var(--pos)' }} />
                Profitabil (marjă ≥ {fmtPct(state.preferences.nearBreakEvenThreshold, 0)})
              </span>
              <span>
                <span className="sw" style={{ background: 'var(--warn)' }} />
                Aproape de break-even (±{fmtPct(state.preferences.nearBreakEvenThreshold, 0)})
              </span>
              <span>
                <span className="sw" style={{ background: 'var(--neg)' }} />
                Neprofitabil
              </span>
            </div>
          </Card>
          {scenarios.length > 0 && (
            <Card title="Scenarii salvate">
              {scenarios.map((s) => (
                <div key={s.id} className="stat-line">
                  <span>{s.name}</span>
                  <a href={href(`/simulator?product=${product.id}&scenario=${s.id}`)}>Deschide</a>
                </div>
              ))}
            </Card>
          )}
          {product.notes && (
            <Card title="Note">
              <div className="small text-2" style={{ whiteSpace: 'pre-wrap' }}>
                {product.notes}
              </div>
            </Card>
          )}
        </div>
      </div>

      <Card title="Presupuneri și surse" sub="Ce valoare a fost folosită pentru fiecare input și de unde provine" tight>
        <AssumptionsTable r={r} />
      </Card>

      {confirmDel && (
        <ConfirmDialog
          title="Ștergi produsul?"
          danger
          confirmLabel="Șterge definitiv"
          message={<>Produsul <b>{product.name}</b> și scenariile lui vor fi șterse.</>}
          onCancel={() => setConfirmDel(false)}
          onConfirm={() => {
            deleteProduct(product.id);
            toast('Produs șters.');
            navigate('/produse');
          }}
        />
      )}
    </div>
  );
}
