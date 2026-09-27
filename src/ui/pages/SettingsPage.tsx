import { useState, type ReactNode } from 'react';
import { CURRENCIES, PRODUCT_STATUSES, type AppState, type CurrencyCode, type ProductStatus } from '../../domain/types';
import { fixedCostPerOrder, totalFixedCosts } from '../../domain/engine';
import { useAppState } from '../../state/store';
import { updateSettings } from '../../state/actions';
import { uid } from '../../utils/id';
import { fmtDateTime, fmtNum, fmtRon } from '../../utils/format';
import { Icon } from '../components/Icon';
import { Alert, Card, NumberField, SelectField, STATUS_LABEL, Switch, TextField, toast } from '../components/ui';

const SECTIONS = [
  ['s-company', 'Companie'],
  ['s-taxes', 'Taxe'],
  ['s-fx', 'Cursuri valutare'],
  ['s-fixed', 'Costuri fixe'],
  ['s-alloc', 'Alocare costuri fixe'],
  ['s-variable', 'Costuri variabile'],
  ['s-returns', 'Retururi & refuzuri'],
  ['s-prefs', 'Preferințe'],
] as const;

function patch<K extends keyof AppState>(key: K, value: Partial<AppState[K]>) {
  updateSettings((s) => ({ ...s, [key]: { ...(s[key] as object), ...value } }));
}

export function SettingsPage() {
  const s = useAppState();
  return (
    <div className="col gap-16">
      <div className="row wrap" style={{ gap: 6 }}>
        {SECTIONS.map(([id, label]) => (
          <button key={id} className="btn sm ghost" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            {label}
          </button>
        ))}
      </div>
      <Alert level="info">
        Setările se aplică tuturor produselor care nu au override. Toate sumele sunt <b>fără TVA</b> (ca plătitor de TVA îl recuperezi), cu excepția
        prețurilor de vânzare și a taxei de livrare încasate. Modificările se salvează automat.
      </Alert>

      <Section id="s-company" title="Companie">
        <div className="form-grid cols-3">
          <TextField label="Nume companie" value={s.companySettings.name} onChange={(v) => patch('companySettings', { name: v })} />
          <TextField label="CUI" value={s.companySettings.cui} onChange={(v) => patch('companySettings', { cui: v })} />
          <TextField label="Note" value={s.companySettings.notes} onChange={(v) => patch('companySettings', { notes: v })} />
        </div>
      </Section>

      <Section id="s-taxes" title="Taxe" sub="TVA-ul este o variabilă – nu este fixat în formule">
        <div className="form-grid cols-3">
          <NumberField
            label="Cotă TVA standard"
            percent
            value={s.taxSettings.vatRate}
            onChange={(v) => patch('taxSettings', { vatRate: v ?? 0 })}
            tip={<>Venit net = Preț brut / (1 + TVA). Poate fi suprascrisă per produs (ex. cotă redusă).</>}
          />
          <NumberField
            label="Taxă vamală default"
            percent
            value={s.taxSettings.customsDutyRate}
            onChange={(v) => patch('taxSettings', { customsDutyRate: v ?? 0 })}
            tip="Aplicată pe (cost furnizor + transport inbound) per unitate. TVA-ul de import nu este inclus – este deductibil."
          />
        </div>
        <div className="section-title">Alte taxe configurabile</div>
        <EditableList
          items={s.taxSettings.otherTaxes}
          empty="Nicio taxă suplimentară. Ex: impozit micro 1% din venit, taxă de mediu per comandă."
          onChange={(items) => patch('taxSettings', { otherTaxes: items })}
          newItem={() => ({ id: uid('tax'), name: '', basis: 'revenue_pct' as const, value: 0, enabled: true })}
          addLabel="Adaugă taxă"
          render={(t, set) => (
            <>
              <div className="grow">
                <TextField value={t.name} placeholder="Denumire (ex. Impozit micro)" onChange={(v) => set({ name: v })} />
              </div>
              <div style={{ width: 200 }}>
                <SelectField
                  value={t.basis}
                  onChange={(v) => set({ basis: v, value: 0 })}
                  options={[
                    { value: 'revenue_pct', label: '% din venit fără TVA' },
                    { value: 'per_order_fixed', label: 'sumă fixă / comandă' },
                  ]}
                />
              </div>
              <div style={{ width: 130 }}>
                <NumberField value={t.value} percent={t.basis === 'revenue_pct'} suffix={t.basis === 'revenue_pct' ? undefined : 'lei'} onChange={(v) => set({ value: v ?? 0 })} />
              </div>
              <Switch checked={t.enabled} onChange={(v) => set({ enabled: v })} label="" />
            </>
          )}
        />
      </Section>

      <Section id="s-fx" title="Cursuri valutare" sub="RON pentru 1 unitate de monedă. Folosite când produsul nu are curs propriu.">
        <FxSettings />
      </Section>

      <Section
        id="s-fixed"
        title="Costuri fixe lunare"
        sub={`Total activ: ${fmtRon(totalFixedCosts(s))} / lună`}
      >
        <EditableList
          items={s.fixedCosts.items}
          empty="Nicio categorie de cost fix."
          onChange={(items) => patch('fixedCosts', { items })}
          newItem={() => ({ id: uid('fc'), name: '', monthlyAmount: 0, enabled: true })}
          addLabel="Adaugă categorie de cost"
          render={(it, set) => (
            <>
              <div className="grow">
                <TextField value={it.name} placeholder="Denumire categorie" onChange={(v) => set({ name: v })} />
              </div>
              <div style={{ width: 170 }}>
                <NumberField value={it.monthlyAmount} suffix="lei/lună" onChange={(v) => set({ monthlyAmount: v ?? 0 })} />
              </div>
              <Switch checked={it.enabled} onChange={(v) => set({ enabled: v })} label="" />
            </>
          )}
        />
      </Section>

      <Section id="s-alloc" title="Alocarea costurilor fixe" sub="Cost fix per comandă = Total costuri fixe / comenzi lunare">
        <AllocationSettings />
      </Section>

      <Section id="s-variable" title="Costuri variabile default" sub="Per comandă, fără TVA. Pot fi suprascrise la nivel de produs.">
        <VariableSettings />
      </Section>

      <Section id="s-returns" title="Retururi, refuzuri, livrări eșuate" sub="Integrate matematic în profitul așteptat per comandă plasată">
        <ReturnSettings />
      </Section>

      <Section id="s-prefs" title="Preferințe de calcul">
        <Preferences />
      </Section>
    </div>
  );
}

function Section({ id, title, sub, children }: { id: string; title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div id={id} style={{ scrollMarginTop: 80 }}>
      <Card title={title} sub={sub}>
        {children}
      </Card>
    </div>
  );
}

function EditableList<T extends { id: string }>({
  items,
  onChange,
  render,
  newItem,
  addLabel,
  empty,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, set: (p: Partial<T>) => void) => ReactNode;
  newItem: () => T;
  addLabel: string;
  empty: string;
}) {
  return (
    <div className="col">
      {items.length === 0 && <div className="muted small">{empty}</div>}
      {items.map((it) => (
        <div key={it.id} className="row" style={{ alignItems: 'center' }}>
          {render(it, (p) => onChange(items.map((x) => (x.id === it.id ? { ...x, ...p } : x))))}
          <button className="btn icon ghost" title="Șterge" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
            <Icon name="trash" />
          </button>
        </div>
      ))}
      <div>
        <button className="btn sm" onClick={() => onChange([...items, newItem()])}>
          <Icon name="plus" /> {addLabel}
        </button>
      </div>
    </div>
  );
}

function FxSettings() {
  const s = useAppState();
  const [loading, setLoading] = useState(false);
  const setRate = (c: CurrencyCode, v: number | null) =>
    patch('fx', { rates: { ...s.fx.rates, [c]: v }, updatedAt: new Date().toISOString() });

  const fetchBnr = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://www.bnr.ro/nbrfxrates.xml', { mode: 'cors' });
      const xml = new DOMParser().parseFromString(await res.text(), 'application/xml');
      const rates: Partial<Record<CurrencyCode, number>> = {};
      xml.querySelectorAll('Rate').forEach((n) => {
        const cur = n.getAttribute('currency') as CurrencyCode;
        const mult = Number(n.getAttribute('multiplier') ?? 1);
        const v = Number(n.textContent);
        if (CURRENCIES.includes(cur) && Number.isFinite(v)) rates[cur] = v / (mult || 1);
      });
      if (!Object.keys(rates).length) throw new Error('fără date');
      patch('fx', { rates: { ...s.fx.rates, ...rates }, updatedAt: new Date().toISOString() });
      toast('Cursuri BNR actualizate.');
    } catch {
      toast('Cursul BNR nu poate fi preluat automat din browser (acces blocat). Introdu cursurile manual de pe bnr.ro.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="col gap-16">
      <div className="form-grid cols-4">
        {CURRENCIES.filter((c) => c !== 'RON').map((c) => (
          <NumberField
            key={c}
            label={`${c} → RON`}
            value={s.fx.rates[c] ?? null}
            allowEmpty
            placeholder="neconfigurat"
            onChange={(v) => setRate(c, v)}
          />
        ))}
      </div>
      <div className="row wrap">
        <button className="btn sm" onClick={fetchBnr} disabled={loading}>
          <Icon name="refresh" /> {loading ? 'Se preia…' : 'Încearcă preluare curs BNR'}
        </button>
        <span className="small muted">Ultima actualizare: {fmtDateTime(s.fx.updatedAt)}. Un produs într-o monedă fără curs are costul calculat ca 0 și este marcat cu eroare.</span>
      </div>
    </div>
  );
}

function AllocationSettings() {
  const s = useAppState();
  const a = s.allocation;
  const per = fixedCostPerOrder(s);
  const total = totalFixedCosts(s);
  return (
    <div className="col gap-16">
      <Switch
        checked={a.includeFixedCosts}
        onChange={(v) => patch('allocation', { includeFixedCosts: v })}
        label="Include costurile fixe în profitul per comandă (Fully Loaded Net Profit)"
      />
      <div className="form-grid cols-3">
        <SelectField
          label="Bază de alocare"
          value={a.basis}
          onChange={(v) => patch('allocation', { basis: v })}
          options={[
            { value: 'delivered', label: 'Comenzi livrate / lună' },
            { value: 'placed', label: 'Comenzi plasate / lună' },
          ]}
          tip="Livrate: costul fix se împarte doar la comenzile livrate; per comandă plasată devine cost × rata de livrare a produsului. Plasate: se împarte la toate comenzile."
        />
        <NumberField
          label={a.basis === 'delivered' ? 'Comenzi livrate / lună' : 'Comenzi plasate / lună'}
          value={a.monthlyOrders}
          onChange={(v) => patch('allocation', { monthlyOrders: v ?? 0 })}
          tip="Volumul total al magazinului pe lună (toate produsele)."
        />
        <div className="kpi compact">
          <div className="kpi-label">Cost fix per comandă {a.basis === 'delivered' ? 'livrată' : 'plasată'}</div>
          <div className="kpi-value num">{per === null ? '—' : fmtRon(per)}</div>
          <div className="kpi-sub">
            {fmtRon(total)} / {fmtNum(a.monthlyOrders)} comenzi
          </div>
        </div>
      </div>
      {!a.includeFixedCosts && <Alert level="info">Alocarea este dezactivată: Profitul net = Profitul de contribuție pentru toate produsele.</Alert>}
      {a.includeFixedCosts && total > 0 && a.monthlyOrders <= 0 && (
        <Alert level="warning">Ai costuri fixe, dar 0 comenzi lunare – costurile fixe nu pot fi alocate și NU sunt incluse în profitul per comandă.</Alert>
      )}
    </div>
  );
}

function VariableSettings() {
  const s = useAppState();
  const v = s.variableCosts;
  const set = (p: Partial<AppState['variableCosts']>) => patch('variableCosts', p);
  return (
    <div className="col gap-16">
      <div>
        <div className="section-title">Logistică</div>
        <div className="form-grid cols-4">
          <NumberField label="Transport către client" suffix="lei" value={v.shippingCost} onChange={(x) => set({ shippingCost: x ?? 0 })} tip="Cost curier per colet expediat. Se plătește și pentru coletele refuzate/returnate." />
          <NumberField label="Taxă livrare încasată (TVA incl.)" suffix="lei" value={v.shippingFeeChargedGross} onChange={(x) => set({ shippingFeeChargedGross: x ?? 0 })} tip="Suma plătită de client pentru livrare. 0 = livrare gratuită. Este venit (fără TVA) doar pentru comenzile păstrate." />
          <NumberField label="Fulfillment / comandă" suffix="lei" value={v.fulfillmentPerOrder} onChange={(x) => set({ fulfillmentPerOrder: x ?? 0 })} />
          <NumberField label="Pick & pack / comandă" suffix="lei" value={v.pickPackPerOrder} onChange={(x) => set({ pickPackPerOrder: x ?? 0 })} />
          <NumberField label="Packaging / comandă" suffix="lei" value={v.packagingPerOrder} onChange={(x) => set({ packagingPerOrder: x ?? 0 })} />
          <NumberField label="Logistică inbound / unitate" suffix="lei" value={v.inboundLogisticsPerUnit} onChange={(x) => set({ inboundLogisticsPerUnit: x ?? 0 })} tip="Transport de la furnizor la depozit, per unitate (ex. cost container / nr. unități)." />
        </div>
      </div>
      <div>
        <div className="section-title">Plăți</div>
        <div className="form-grid cols-4">
          <NumberField label="Pondere comenzi ramburs" percent value={v.codShare} onChange={(x) => set({ codShare: x ?? 0 })} tip="Restul comenzilor sunt considerate plătite cu cardul." />
          <NumberField label="Comision ramburs %" percent value={v.codFeePct} onChange={(x) => set({ codFeePct: x ?? 0 })} tip="Aplicat pe valoarea comenzii încasate, doar pentru comenzile livrate." />
          <NumberField label="Comision ramburs fix" suffix="lei" value={v.codFeeFixed} onChange={(x) => set({ codFeeFixed: x ?? 0 })} />
          <div />
          <NumberField label="Procesator card %" percent value={v.paymentProcessorPct} onChange={(x) => set({ paymentProcessorPct: x ?? 0 })} tip="Aplicat pe valoarea comenzii cu TVA, pentru toate comenzile plătite cu cardul (comisionul nu se recuperează la refund)." />
          <NumberField label="Procesator card fix" suffix="lei" value={v.paymentProcessorFixed} onChange={(x) => set({ paymentProcessorFixed: x ?? 0 })} />
        </div>
      </div>
      <div>
        <div className="section-title">Suport clienți</div>
        <div className="form-grid cols-4">
          <NumberField label="Call center / comandă" suffix="lei" value={v.callCenterPerOrder} onChange={(x) => set({ callCenterPerOrder: x ?? 0 })} tip="Cost variabil de confirmare telefonică, per comandă plasată." />
          <NumberField label="SMS / comandă" suffix="lei" value={v.smsPerOrder} onChange={(x) => set({ smsPerOrder: x ?? 0 })} />
        </div>
      </div>
      <div>
        <div className="section-title">Alte costuri variabile</div>
        <EditableList
          items={v.other}
          empty="Niciun alt cost variabil."
          onChange={(items) => set({ other: items })}
          newItem={() => ({ id: uid('ov'), name: '', basis: 'per_order' as const, value: 0, enabled: true })}
          addLabel="Adaugă cost variabil"
          render={(o, setO) => (
            <>
              <div className="grow">
                <TextField value={o.name} placeholder="Denumire (ex. asigurare colet)" onChange={(x) => setO({ name: x })} />
              </div>
              <div style={{ width: 200 }}>
                <SelectField
                  value={o.basis}
                  onChange={(b) => setO({ basis: b, value: 0 })}
                  options={[
                    { value: 'per_order', label: 'per comandă plasată' },
                    { value: 'per_unit', label: 'per unitate' },
                    { value: 'revenue_pct', label: '% din venit fără TVA' },
                  ]}
                />
              </div>
              <div style={{ width: 130 }}>
                <NumberField value={o.value} percent={o.basis === 'revenue_pct'} suffix={o.basis === 'revenue_pct' ? undefined : 'lei'} onChange={(x) => setO({ value: x ?? 0 })} />
              </div>
              <Switch checked={o.enabled} onChange={(x) => setO({ enabled: x })} label="" />
            </>
          )}
        />
      </div>
    </div>
  );
}

function ReturnSettings() {
  const s = useAppState();
  const r = s.returnSettings;
  const set = (p: Partial<AppState['returnSettings']>) => patch('returnSettings', p);
  const delivered = Math.max(0, 1 - r.refusalRate - r.failedDeliveryRate);
  const kept = delivered * (1 - r.returnRate);
  return (
    <div className="col gap-16">
      <div className="form-grid cols-3">
        <NumberField label="Rată refuz" percent value={r.refusalRate} onChange={(x) => set({ refusalRate: x ?? 0 })} tip="% din comenzile PLASATE (expediate) refuzate de client la livrare." />
        <NumberField label="Rată livrare eșuată" percent value={r.failedDeliveryRate} onChange={(x) => set({ failedDeliveryRate: x ?? 0 })} tip="% din comenzile PLASATE care nu pot fi livrate (adresă greșită, client de negăsit) și se întorc." />
        <NumberField label="Rată retur" percent value={r.returnRate} onChange={(x) => set({ returnRate: x ?? 0 })} tip="% din comenzile LIVRATE returnate ulterior de client (ex. drept de retur 14 zile)." />
        <NumberField label="Cost transport retur / colet" suffix="lei" value={r.returnShippingCost} onChange={(x) => set({ returnShippingCost: x ?? 0 })} tip="Aplicat fiecărui colet care se întoarce: retur, refuz sau nelivrat." />
        <NumberField label="Cost procesare retur / colet" suffix="lei" value={r.returnProcessingCost} onChange={(x) => set({ returnProcessingCost: x ?? 0 })} tip="Recepție, verificare, reambalare." />
        <NumberField label="Marfă întoarsă nerevandabilă" percent value={r.unsellableRate} onChange={(x) => set({ unsellableRate: x ?? 0 })} tip="Procentul din unitățile întoarse care se pierd (cost landed integral)." />
      </div>
      {r.refusalRate + r.failedDeliveryRate > 1 && <Alert level="warning">Refuz + nelivrare depășesc 100% – rata de nelivrare va fi limitată automat.</Alert>}
      <div className="formula-box">
        Din 100 comenzi plasate: <b>{fmtNum(r.refusalRate * 100, 1)}</b> refuzate, <b>{fmtNum(Math.min(r.failedDeliveryRate, 1 - r.refusalRate) * 100, 1)}</b> nelivrate,{' '}
        <b>{fmtNum(delivered * 100, 1)}</b> livrate, din care <b>{fmtNum(delivered * r.returnRate * 100, 1)}</b> returnate →{' '}
        <b className="pos">{fmtNum(kept * 100, 1)}</b> generează venit. Transportul dus se plătește pentru toate 100.
      </div>
    </div>
  );
}

function Preferences() {
  const s = useAppState();
  const p = s.preferences;
  const set = (x: Partial<AppState['preferences']>) => patch('preferences', x);
  const toggleStatus = (st: ProductStatus) =>
    set({ projectionStatuses: p.projectionStatuses.includes(st) ? p.projectionStatuses.filter((x) => x !== st) : [...p.projectionStatuses, st] });
  return (
    <div className="col gap-16">
      <div className="form-grid cols-3">
        <NumberField label="Zile / lună" value={p.daysPerMonth} onChange={(x) => set({ daysPerMonth: x ?? 0 })} max={31} />
        <NumberField label="Comenzi / zi default" value={p.defaultOrdersPerDay} onChange={(x) => set({ defaultOrdersPerDay: x ?? 0 })} tip="Folosit pentru produsele fără estimare proprie de comenzi/zi." />
        <NumberField
          label="Prag „aproape de break-even”"
          percent
          value={p.nearBreakEvenThreshold}
          onChange={(x) => set({ nearBreakEvenThreshold: x ?? 0 })}
          tip="Marja netă între −prag și +prag este marcată „aproape de break-even”. Peste = profitabil, sub = neprofitabil."
        />
      </div>
      <div>
        <div className="field-label mb-8">Statusuri incluse în proiecțiile lunare din Dashboard</div>
        <div className="row wrap">
          {PRODUCT_STATUSES.map((st) => (
            <label key={st} className="row small" style={{ gap: 6, marginRight: 12, cursor: 'pointer' }}>
              <input type="checkbox" className="checkbox" checked={p.projectionStatuses.includes(st)} onChange={() => toggleStatus(st)} />
              {STATUS_LABEL[st]}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
