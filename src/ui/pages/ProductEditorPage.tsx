import { useEffect, useMemo, useState } from 'react';
import { createEmptyProduct } from '../../domain/defaults';
import { calculateProduct } from '../../domain/engine';
import { CURRENCIES, PRODUCT_STATUSES, type AppState, type CurrencyCode, type OverrideKey, type Product, type ProductExtraCost } from '../../domain/types';
import { useAppState } from '../../state/store';
import { upsertProduct } from '../../state/actions';
import { href, navigate } from '../../state/router';
import { uid } from '../../utils/id';
import { fmtNum, fmtPct, fmtRon } from '../../utils/format';
import { fetchProductInfo, nameFromUrl, safeUrl, type FetchedInfo } from '../../utils/url';
import { Icon } from '../components/Icon';
import { Alert, Card, NumberField, SelectField, STATUS_LABEL, Switch, TextField, toast, Warnings } from '../components/ui';
import { BreakEvenMini, LiveResults } from './productParts';

const DRAFT_KEY = 'ecp.draft.new';

function loadDraft(): Product | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Product;
    return p && typeof p === 'object' && typeof p.id === 'string' ? { ...createEmptyProduct(), ...p } : null;
  } catch {
    return null;
  }
}
function saveDraft(p: Product | null) {
  try {
    if (p) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(p));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignorăm */
  }
}

export function ProductEditorPage({ productId }: { productId?: string }) {
  const state = useAppState();
  const existing = productId ? state.products.find((p) => p.id === productId) : undefined;
  const isNew = !productId;
  const [draft, setDraft] = useState<Product>(() => (existing ? structuredClone(existing) : loadDraft() ?? createEmptyProduct()));
  const [touched, setTouched] = useState(false);
  const [restored] = useState(() => isNew && loadDraft() !== null);

  useEffect(() => {
    if (isNew && touched) saveDraft(draft);
  }, [draft, isNew, touched]);

  const result = useMemo(() => calculateProduct(draft, state), [draft, state]);

  if (productId && !existing) {
    return (
      <Card>
        <div className="empty">
          Produsul nu există (poate a fost șters). <a href={href('/produse')}>Înapoi la produse</a>
        </div>
      </Card>
    );
  }

  const set = (patch: Partial<Product>) => {
    setTouched(true);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const setOverride = (k: OverrideKey, v: number | null) => {
    setTouched(true);
    setDraft((d) => {
      const o = { ...d.overrides };
      if (v === null) delete o[k];
      else o[k] = v;
      return { ...d, overrides: o };
    });
  };

  const canSave = draft.sellingPriceGross > 0 || draft.name.trim() !== '';

  const save = (andNew = false) => {
    const toSave = { ...draft, name: draft.name.trim() || nameFromUrl(draft.supplierUrl) || 'Produs fără nume' };
    upsertProduct(toSave);
    if (isNew) saveDraft(null);
    toast(isNew ? 'Produs salvat.' : 'Modificări salvate.');
    if (andNew) {
      setDraft(createEmptyProduct());
      setTouched(false);
      window.scrollTo(0, 0);
    } else navigate(`/produse/${toSave.id}`);
  };

  const discard = () => {
    if (isNew) {
      saveDraft(null);
      setDraft(createEmptyProduct());
      setTouched(false);
    } else navigate(`/produse/${productId}`);
  };

  const overrideCount = Object.values(draft.overrides).filter((v) => typeof v === 'number').length + draft.extraCosts.length;

  return (
    <div className="split">
      <div className="col gap-16">
        {restored && !touched && (
          <Alert level="info">
            Am restaurat ciorna nesalvată.{' '}
            <button className="link-btn" onClick={discard}>
              Începe de la zero
            </button>
          </Alert>
        )}
        <Card title="Evaluare rapidă" sub="Completează 4 câmpuri – restul costurilor vin din Setări companie">
          <QuickForm draft={draft} set={set} state={state} />
        </Card>

        <details className="card advanced" open={overrideCount > 0 || undefined}>
          <summary>
            <Icon name="chevron" className="chev" />
            <span>Setări avansate & override-uri</span>
            {overrideCount > 0 && <span className="badge near">{overrideCount} active</span>}
            <span className="muted small" style={{ marginLeft: 'auto', fontWeight: 400 }}>
              Câmpurile goale folosesc valorile din Setări
            </span>
          </summary>
          <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
            <AdvancedForm draft={draft} set={set} setOverride={setOverride} state={state} />
          </div>
        </details>

        <div className="row wrap">
          <button className="btn primary" onClick={() => save(false)} disabled={!canSave}>
            <Icon name="save" /> {isNew ? 'Salvează produsul' : 'Salvează modificările'}
          </button>
          {isNew && (
            <button className="btn" onClick={() => save(true)} disabled={!canSave}>
              Salvează și adaugă altul
            </button>
          )}
          <button className="btn ghost" onClick={discard}>
            {isNew ? 'Golește formularul' : 'Anulează'}
          </button>
          <span className="muted small">Calculul se actualizează instant, pe măsură ce scrii.</span>
        </div>
      </div>

      <div className="sticky col gap-16">
        <Card title="Rezultat" sub="Per comandă plasată · actualizat live">
          <div className="col gap-16">
            <LiveResults r={result} />
            <BreakEvenMini r={result} />
            <Warnings warnings={result.warnings} />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Formular rapid ---------------- */

function QuickForm({ draft, set, state }: { draft: Product; set: (p: Partial<Product>) => void; state: AppState }) {
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState<FetchedInfo | null>(null);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const suggestion = draft.name.trim() === '' ? nameFromUrl(draft.supplierUrl) : null;
  const settingsFx = draft.currency !== 'RON' ? state.fx.rates[draft.currency] : null;
  const urlOk = !draft.supplierUrl || safeUrl(draft.supplierUrl) !== null;

  const doFetch = async () => {
    setFetching(true);
    setFetchErr(null);
    setFetched(null);
    try {
      setFetched(await fetchProductInfo(draft.supplierUrl));
    } catch (e) {
      setFetchErr((e as Error).message);
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="form-grid">
      <div className="span-all">
        <div className="field">
          <label className="field-label" htmlFor="supplier-url">
            URL produs furnizor
          </label>
          <div className="row">
            <input
              id="supplier-url"
              className={`input ${urlOk ? '' : 'invalid'}`}
              placeholder="https://..."
              value={draft.supplierUrl}
              autoFocus={!draft.supplierUrl}
              onChange={(e) => set({ supplierUrl: e.target.value })}
            />
            <button className="btn" onClick={doFetch} disabled={!safeUrl(draft.supplierUrl) || fetching} title="Opțional – multe site-uri blochează citirea automată">
              <Icon name="refresh" /> {fetching ? 'Se citește…' : 'Preia informații'}
            </button>
            {safeUrl(draft.supplierUrl) && (
              <a className="btn icon ghost" href={safeUrl(draft.supplierUrl)!} target="_blank" rel="noreferrer noopener" title="Deschide în tab nou">
                <Icon name="external" />
              </a>
            )}
          </div>
          {!urlOk && <span className="field-error">URL-ul trebuie să înceapă cu http:// sau https://</span>}
          {fetchErr && <span className="field-hint warn">{fetchErr}</span>}
          {fetched && (
            <div className="formula-box mt-8">
              <div>Titlu găsit: <b>{fetched.title ?? '—'}</b></div>
              <div>
                Preț găsit: <b>{fetched.price !== null ? `${fmtNum(fetched.price, 2)} ${fetched.currency ?? ''}` : '—'}</b>
              </div>
              <div className="row mt-8">
                {fetched.title && (
                  <button className="btn sm" onClick={() => set({ name: fetched.title!.slice(0, 120) })}>
                    Folosește titlul
                  </button>
                )}
                {fetched.price !== null && (
                  <button
                    className="btn sm"
                    onClick={() => {
                      const cur = (fetched.currency ?? '').toUpperCase() as CurrencyCode;
                      set({ supplierCost: fetched.price!, ...(CURRENCIES.includes(cur) ? { currency: cur } : {}) });
                    }}
                  >
                    Folosește prețul ca cost furnizor
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="span-all">
        <TextField label="Nume produs" value={draft.name} onChange={(v) => set({ name: v })} placeholder="ex. Lampă LED senzor mișcare" />
        {suggestion && (
          <div className="field-hint mt-8">
            Sugestie din URL:{' '}
            <button className="link-btn" onClick={() => set({ name: suggestion })}>
              {suggestion}
            </button>
          </div>
        )}
      </div>

      <NumberField
        label="Cost produs la furnizor"
        value={draft.supplierCost}
        onChange={(v) => set({ supplierCost: v ?? 0 })}
        suffix={draft.currency}
        size="lg"
        tip="Costul per unitate, în moneda furnizorului. Ca plătitor de TVA, introdu costul FĂRĂ TVA deductibil (sau bifează opțiunea din Setări avansate)."
      />
      <div className="form-grid" style={{ gap: 10 }}>
        <SelectField
          label="Monedă"
          value={draft.currency}
          onChange={(v) => set({ currency: v, fxRate: null })}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
        {draft.currency !== 'RON' ? (
          <NumberField
            label={`Curs ${draft.currency}/RON`}
            value={draft.fxRate}
            allowEmpty
            onChange={(v) => set({ fxRate: v })}
            placeholder={settingsFx ? toPlaceholder(settingsFx) : 'necesar'}
            hint={settingsFx ? `Gol = ${fmtNum(settingsFx, 4)} din Setări` : 'Curs lipsă în Setări'}
            highlight={draft.fxRate !== null}
          />
        ) : (
          <div className="field">
            <span className="field-label">Curs</span>
            <div className="input" style={{ display: 'flex', alignItems: 'center', color: 'var(--muted)' }}>
              1,00
            </div>
          </div>
        )}
      </div>

      <NumberField
        label="Preț de vânzare (TVA inclus)"
        value={draft.sellingPriceGross}
        onChange={(v) => set({ sellingPriceGross: v ?? 0 })}
        suffix="lei"
        size="lg"
        tip={`Prețul final plătit de client, per unitate, cu TVA ${fmtPct(draft.overrides.vatRate ?? state.taxSettings.vatRate, 0)} inclus.`}
      />
      <NumberField
        label="CPA (cost per comandă)"
        value={draft.cpa}
        onChange={(v) => set({ cpa: v ?? 0 })}
        suffix="lei"
        size="lg"
        tip="Cost de achiziție per comandă PLASATĂ = buget reclame / comenzi plasate. Estimat sau real (din Meta/TikTok/Google)."
      />
      <NumberField
        label="Unități medii per comandă"
        value={draft.unitsPerOrder}
        onChange={(v) => set({ unitsPerOrder: v ?? 1 })}
        tip="Poate fi zecimal (ex. 1,3 dacă ai oferte de tip 2+1). Costul produsului și prețul se înmulțesc cu această valoare."
      />
      <NumberField
        label="Comenzi estimate / zi"
        value={draft.ordersPerDay}
        allowEmpty
        onChange={(v) => set({ ordersPerDay: v })}
        placeholder={toPlaceholder(state.preferences.defaultOrdersPerDay)}
        hint={`Gol = ${fmtNum(state.preferences.defaultOrdersPerDay)} (default din Setări)`}
        tip="Folosit pentru proiecțiile de profit pe zi și pe lună."
      />
    </div>
  );
}

function toPlaceholder(v: number | null | undefined, percent = false): string {
  if (v === null || v === undefined) return '';
  return fmtNum(percent ? v * 100 : v, 4);
}

/* ---------------- Formular avansat ---------------- */

type OvField = { key: OverrideKey; label: string; percent?: boolean; tip?: string };

const OV_GROUPS: { title: string; fields: OvField[] }[] = [
  {
    title: 'Taxe',
    fields: [
      { key: 'vatRate', label: 'Cotă TVA', percent: true, tip: 'Ex. 11% pentru produse cu cotă redusă.' },
      { key: 'customsDutyRate', label: 'Taxă vamală', percent: true, tip: 'Aplicată pe (cost furnizor + inbound) per unitate.' },
    ],
  },
  {
    title: 'Logistică',
    fields: [
      { key: 'inboundLogisticsPerUnit', label: 'Inbound / unitate' },
      { key: 'shippingCost', label: 'Transport către client' },
      { key: 'shippingFeeChargedGross', label: 'Taxă livrare încasată (cu TVA)' },
      { key: 'fulfillmentPerOrder', label: 'Fulfillment' },
      { key: 'pickPackPerOrder', label: 'Pick & pack' },
      { key: 'packagingPerOrder', label: 'Packaging' },
    ],
  },
  {
    title: 'Plăți',
    fields: [
      { key: 'codShare', label: 'Pondere ramburs', percent: true },
      { key: 'codFeePct', label: 'Comision ramburs %', percent: true },
      { key: 'codFeeFixed', label: 'Comision ramburs fix' },
      { key: 'paymentProcessorPct', label: 'Procesator card %', percent: true },
      { key: 'paymentProcessorFixed', label: 'Procesator card fix' },
    ],
  },
  {
    title: 'Suport clienți',
    fields: [
      { key: 'callCenterPerOrder', label: 'Call center / comandă' },
      { key: 'smsPerOrder', label: 'SMS / comandă' },
    ],
  },
  {
    title: 'Retururi & refuzuri',
    fields: [
      { key: 'returnRate', label: 'Rată retur (din livrate)', percent: true },
      { key: 'refusalRate', label: 'Rată refuz', percent: true },
      { key: 'failedDeliveryRate', label: 'Rată nelivrare', percent: true },
      { key: 'returnShippingCost', label: 'Transport retur / colet' },
      { key: 'returnProcessingCost', label: 'Procesare retur / colet' },
      { key: 'unsellableRate', label: 'Marfă nerevandabilă', percent: true },
    ],
  },
];

function defaultValue(k: OverrideKey, s: AppState): number {
  if (k === 'vatRate') return s.taxSettings.vatRate;
  if (k === 'customsDutyRate') return s.taxSettings.customsDutyRate;
  if (k in s.returnSettings) return s.returnSettings[k as keyof AppState['returnSettings']];
  return (s.variableCosts as unknown as Record<string, number>)[k];
}

function AdvancedForm({
  draft,
  set,
  setOverride,
  state,
}: {
  draft: Product;
  set: (p: Partial<Product>) => void;
  setOverride: (k: OverrideKey, v: number | null) => void;
  state: AppState;
}) {
  const extras = draft.extraCosts;
  const setExtras = (e: ProductExtraCost[]) => set({ extraCosts: e });
  return (
    <div className="col gap-16">
      <div className="form-grid cols-3">
        <SelectField
          label="Status"
          value={draft.status}
          onChange={(v) => set({ status: v })}
          options={PRODUCT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          tip="Produsele cu status Testare/Activ/Scalare (configurabil) intră în proiecțiile lunare din Dashboard."
        />
        <div className="field" style={{ justifyContent: 'flex-end', paddingBottom: 8 }}>
          <Switch
            checked={draft.supplierCostIncludesVat}
            onChange={(v) => set({ supplierCostIncludesVat: v })}
            label="Costul furnizorului include TVA deductibil"
          />
        </div>
      </div>

      {OV_GROUPS.map((g) => (
        <div key={g.title}>
          <div className="section-title">{g.title}</div>
          <div className="form-grid cols-3">
            {g.fields.map((f) => {
              const ov = draft.overrides[f.key];
              const def = defaultValue(f.key, state);
              const active = typeof ov === 'number';
              return (
                <NumberField
                  key={f.key}
                  label={
                    <>
                      {f.label}
                      {active && (
                        <button className="link-btn xs" onClick={() => setOverride(f.key, null)} style={{ marginLeft: 'auto' }}>
                          resetează
                        </button>
                      )}
                    </>
                  }
                  tip={f.tip}
                  value={ov ?? null}
                  percent={f.percent}
                  suffix={f.percent ? undefined : 'lei'}
                  allowEmpty
                  highlight={active}
                  placeholder={toPlaceholder(def, f.percent)}
                  hint={`Default: ${f.percent ? fmtPct(def, 2) : fmtRon(def)}`}
                  onChange={(v) => setOverride(f.key, v)}
                />
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <div className="section-title">Costuri specifice produsului</div>
        <div className="col">
          {extras.map((e, idx) => (
            <div key={e.id} className="row" style={{ alignItems: 'flex-end' }}>
              <div className="grow">
                <TextField
                  label={idx === 0 ? 'Denumire' : undefined}
                  value={e.name}
                  placeholder="ex. Cadou în colet, licență, certificare"
                  onChange={(v) => setExtras(extras.map((x) => (x.id === e.id ? { ...x, name: v } : x)))}
                />
              </div>
              <div style={{ width: 130 }}>
                <NumberField
                  label={idx === 0 ? 'Sumă (fără TVA)' : undefined}
                  value={e.amount}
                  suffix="lei"
                  onChange={(v) => setExtras(extras.map((x) => (x.id === e.id ? { ...x, amount: v ?? 0 } : x)))}
                />
              </div>
              <div style={{ width: 190 }}>
                <SelectField
                  label={idx === 0 ? 'Bază' : undefined}
                  value={e.basis}
                  onChange={(v) => setExtras(extras.map((x) => (x.id === e.id ? { ...x, basis: v } : x)))}
                  options={[
                    { value: 'per_unit', label: 'per unitate' },
                    { value: 'per_order', label: 'per comandă plasată' },
                    { value: 'per_delivered_order', label: 'per comandă livrată' },
                  ]}
                />
              </div>
              <button className="btn icon ghost" title="Elimină" onClick={() => setExtras(extras.filter((x) => x.id !== e.id))} style={{ marginBottom: 3 }}>
                <Icon name="trash" />
              </button>
            </div>
          ))}
          <div>
            <button className="btn sm" onClick={() => setExtras([...extras, { id: uid('ex'), name: '', amount: 0, basis: 'per_order' }])}>
              <Icon name="plus" /> Adaugă cost specific
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="section-title">Note</div>
        <textarea className="input" rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Observații, furnizor alternativ, rezultate teste…" />
      </div>
    </div>
  );
}
