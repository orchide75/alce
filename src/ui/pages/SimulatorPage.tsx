import { useEffect, useMemo, useState } from 'react';
import {
  calculateProduct,
  calculateScenario,
  cpaSensitivity,
  QUICK_SCENARIOS,
  quickScenarioAdjustments,
  resolveInputs,
  type ProductResult,
  type QuickScenario,
} from '../../domain/engine';
import type { ScenarioAdjustments } from '../../domain/types';
import { useAppState } from '../../state/store';
import { deleteScenario, saveScenario } from '../../state/actions';
import { href, navigate, useRoute } from '../../state/router';
import { fmtNum, fmtPct, fmtRon, fmtX } from '../../utils/format';
import { Icon } from '../components/Icon';
import { Card, Kpi, NumberField, ProfitBadge, TextField, toast, toneOf, Warnings, Modal } from '../components/ui';
import { BreakEvenPanel, SensitivityTable } from '../components/results';

type AdjKey = keyof Required<ScenarioAdjustments>;

interface SliderDef {
  key: AdjKey;
  label: string;
  percent?: boolean;
  suffix?: string;
  max: (base: number) => number;
  step: number;
}

const SLIDERS: SliderDef[] = [
  { key: 'cpa', label: 'CPA', suffix: 'lei', max: (b) => Math.max(100, b * 3), step: 0.5 },
  { key: 'sellingPriceGross', label: 'Preț vânzare (TVA inclus)', suffix: 'lei', max: (b) => Math.max(100, b * 2.5), step: 1 },
  { key: 'supplierCostRon', label: 'COGS – cost produs / unitate (RON)', suffix: 'lei', max: (b) => Math.max(50, b * 3), step: 0.5 },
  { key: 'returnRate', label: 'Rată retur (din livrate)', percent: true, max: () => 1, step: 0.005 },
  { key: 'refusalRate', label: 'Rată refuz', percent: true, max: () => 1, step: 0.005 },
  { key: 'shippingCost', label: 'Cost transport / colet', suffix: 'lei', max: (b) => Math.max(50, b * 3), step: 0.5 },
  { key: 'ordersPerDay', label: 'Comenzi / zi', max: (b) => Math.max(100, b * 5), step: 1 },
];

export function SimulatorPage() {
  const state = useAppState();
  const route = useRoute();
  const qProduct = route.query.get('product');
  const qScenario = route.query.get('scenario');
  const productId = qProduct && state.products.some((p) => p.id === qProduct) ? qProduct : state.products[0]?.id;
  const product = state.products.find((p) => p.id === productId);

  const baseInputs = useMemo(() => (product ? resolveInputs(product, state).inputs : null), [product, state]);
  const [adj, setAdj] = useState<ScenarioAdjustments>({});
  const [activeQuick, setActiveQuick] = useState<QuickScenario | null>('baza');
  const [saving, setSaving] = useState(false);
  const [scName, setScName] = useState('');

  // reinițializare la schimbarea produsului / scenariului
  useEffect(() => {
    if (!baseInputs) return;
    const sc = qScenario ? state.scenarios.find((s) => s.id === qScenario && s.productId === productId) : null;
    if (sc) {
      setAdj({ ...quickScenarioAdjustments(baseInputs, 'baza'), ...sc.adjustments });
      setActiveQuick(null);
    } else {
      setAdj(quickScenarioAdjustments(baseInputs, 'baza'));
      setActiveQuick('baza');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, qScenario]);

  const base = useMemo(() => (product ? calculateProduct(product, state) : null), [product, state]);
  const sim = useMemo(() => (product ? calculateScenario(product, state, adj) : null), [product, state, adj]);
  const rows = useMemo(() => (sim ? cpaSensitivity(sim.analysis.inputs, state.preferences.nearBreakEvenThreshold) : []), [sim, state.preferences.nearBreakEvenThreshold]);

  if (!state.products.length || !product || !baseInputs || !base || !sim) {
    return (
      <Card>
        <div className="empty">
          <h3>Niciun produs de simulat</h3>
          <p>Adaugă un produs pentru a rula scenarii.</p>
          <a className="btn primary mt-16" href={href('/produse/nou')}>
            <Icon name="plus" /> Adaugă produs
          </a>
        </div>
      </Card>
    );
  }

  const set = (k: AdjKey, v: number) => {
    setAdj((a) => ({ ...a, [k]: v }));
    setActiveQuick(null);
  };
  const applyQuick = (k: QuickScenario) => {
    setAdj(quickScenarioAdjustments(baseInputs, k));
    setActiveQuick(k);
  };
  const productScenarios = state.scenarios.filter((s) => s.productId === product.id);

  return (
    <div className="col gap-16">
      <div className="row wrap between">
        <div className="row wrap">
          <select
            className="input"
            style={{ width: 300 }}
            value={product.id}
            onChange={(e) => navigate(`/simulator?product=${e.target.value}`)}
            aria-label="Produs"
          >
            {state.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || 'Fără nume'}
              </option>
            ))}
          </select>
          <div className="btn-group" role="group" aria-label="Scenarii rapide">
            {QUICK_SCENARIOS.map((q) => (
              <button key={q.key} className={activeQuick === q.key ? 'on' : ''} onClick={() => applyQuick(q.key)} title={q.description}>
                {q.label}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <a className="btn" href={href(`/produse/${product.id}`)}>
            <Icon name="eye" /> Detalii produs
          </a>
          <button className="btn primary" onClick={() => { setScName(`Scenariu ${productScenarios.length + 1}`); setSaving(true); }}>
            <Icon name="save" /> Salvează scenariul
          </button>
        </div>
      </div>
      <div className="small muted">
        {activeQuick ? QUICK_SCENARIOS.find((q) => q.key === activeQuick)!.description : 'Scenariu personalizat'} · Simulatorul NU modifică produsul salvat.
      </div>

      <div className="split">
        <div className="col gap-16">
          <div className="grid grid-4">
            <Kpi label="Profit net / comandă" value={fmtRon(sim.analysis.netProfit)} tone={toneOf(sim.analysis.netProfit)} sub={<Delta v={sim.analysis.netProfit - base.analysis.netProfit} />} />
            <Kpi label="Profit / zi" value={fmtRon(sim.analysis.profitPerDay, { decimals: 0 })} tone={toneOf(sim.analysis.profitPerDay)} sub={<Delta v={sim.analysis.profitPerDay - base.analysis.profitPerDay} decimals={0} />} />
            <Kpi label="Profit / lună" value={fmtRon(sim.analysis.profitPerMonth, { decimals: 0 })} tone={toneOf(sim.analysis.profitPerMonth)} sub={<Delta v={sim.analysis.profitPerMonth - base.analysis.profitPerMonth} decimals={0} />} />
            <Kpi label="Marjă netă" value={fmtPct(sim.analysis.netMargin)} tone={toneOf(sim.analysis.netMargin)} sub={<DeltaPct a={sim.analysis.netMargin} b={base.analysis.netMargin} />} />
          </div>
          <div className="grid grid-4">
            <Kpi compact label="Break-even CPA" value={fmtRon(sim.analysis.breakEven.cpaNet)} sub={<Delta v={sim.analysis.breakEven.cpaNet - base.analysis.breakEven.cpaNet} />} />
            <Kpi compact label="Break-even ROAS" value={fmtX(sim.analysis.breakEven.roasGross)} sub={`ROAS la CPA simulat: ${fmtX(sim.analysis.breakEven.currentRoasGross)}`} />
            <Kpi compact label="Contribuție / comandă" value={fmtRon(sim.analysis.contributionProfit)} tone={toneOf(sim.analysis.contributionProfit)} sub={`marjă ${fmtPct(sim.analysis.contributionMargin)}`} />
            <div className="kpi compact">
              <div className="kpi-label">Status</div>
              <div style={{ marginTop: 8 }}>
                <ProfitBadge cls={sim.profitClass} />
              </div>
              <div className="kpi-sub">bază: {fmtRon(base.analysis.netProfit)}/comandă</div>
            </div>
          </div>
          <Warnings warnings={sim.warnings} filter={['error']} />

          <Card title="Break-even în scenariul simulat">
            <BreakEvenPanel r={sim} />
          </Card>
          <Card title="Sensibilitate la CPA (scenariu simulat)" tight>
            <SensitivityTable rows={rows} />
          </Card>
        </div>

        <div className="sticky col gap-16">
          <Card title="Parametri" sub="Glisează sau scrie valoarea exactă">
            <div className="col" style={{ gap: 18 }}>
              {SLIDERS.map((s) => (
                <Slider key={s.key} def={s} value={adj[s.key] ?? 0} base={baseValue(base, s.key)} onChange={(v) => set(s.key, v)} />
              ))}
              <button className="btn sm" onClick={() => applyQuick('baza')}>
                <Icon name="refresh" /> Resetează la valorile produsului
              </button>
            </div>
          </Card>
          {productScenarios.length > 0 && (
            <Card title="Scenarii salvate">
              {productScenarios.map((s) => (
                <div key={s.id} className="stat-line">
                  <a href={href(`/simulator?product=${product.id}&scenario=${s.id}`)}>{s.name}</a>
                  <button className="btn icon ghost" title="Șterge scenariul" onClick={() => { deleteScenario(s.id); toast('Scenariu șters.'); }}>
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {saving && (
        <Modal
          title="Salvează scenariul"
          onClose={() => setSaving(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setSaving(false)}>
                Anulează
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  saveScenario({ name: scName.trim() || 'Scenariu', productId: product.id, adjustments: adj });
                  setSaving(false);
                  toast('Scenariu salvat. Este inclus în exportul JSON.');
                }}
              >
                Salvează
              </button>
            </>
          }
        >
          <TextField label="Nume scenariu" value={scName} onChange={setScName} autoFocus />
        </Modal>
      )}
    </div>
  );
}

function baseValue(r: ProductResult, k: AdjKey): number {
  return r.analysis.inputs[k];
}

function Slider({ def, value, base, onChange }: { def: SliderDef; value: number; base: number; onChange: (v: number) => void }) {
  const max = Math.max(def.max(base), value);
  const changed = Math.abs(value - base) > 1e-9;
  return (
    <div>
      <div className="row between" style={{ marginBottom: 6 }}>
        <span className="field-label">{def.label}</span>
        <span className="xs muted">
          bază {def.percent ? fmtPct(base, 1) : def.suffix === 'lei' ? fmtRon(base) : fmtNum(base, 2)}
          {changed && (
            <button className="link-btn" style={{ marginLeft: 6 }} onClick={() => onChange(base)}>
              ↺
            </button>
          )}
        </span>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <input
          type="range"
          min={0}
          max={max}
          step={def.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={def.label}
        />
        <div style={{ width: 118, flexShrink: 0 }}>
          <NumberField value={value} onChange={(v) => onChange(v ?? 0)} percent={def.percent} suffix={def.suffix} highlight={changed} />
        </div>
      </div>
    </div>
  );
}

function Delta({ v, decimals = 2 }: { v: number; decimals?: 0 | 2 }) {
  if (Math.abs(v) < 0.005) return <span className="muted">egal cu baza</span>;
  return <span className={v > 0 ? 'pos' : 'neg'}>{fmtRon(v, { decimals, sign: true })} vs bază</span>;
}

function DeltaPct({ a, b }: { a: number | null; b: number | null }) {
  if (a === null || b === null) return <span className="muted">—</span>;
  const d = a - b;
  if (Math.abs(d) < 0.00005) return <span className="muted">egal cu baza</span>;
  return <span className={d > 0 ? 'pos' : 'neg'}>{fmtNum(d * 100, 1)} pp vs bază</span>;
}
