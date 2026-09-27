import { useMemo, useState } from 'react';
import { calculateProduct, type ProductResult } from '../../domain/engine';
import { PRODUCT_STATUSES, type ProductStatus, type ProfitClass } from '../../domain/types';
import { useAppState } from '../../state/store';
import { deleteProduct, duplicateProduct, updatePreferences } from '../../state/actions';
import { href, navigate } from '../../state/router';
import { fmtPct, fmtRon } from '../../utils/format';
import { safeUrl } from '../../utils/url';
import { Icon } from '../components/Icon';
import { Card, ConfirmDialog, ProfitBadge, STATUS_LABEL, StatusBadge, toast, toneOf, Tip } from '../components/ui';

type Col = {
  key: string;
  label: string;
  num?: boolean;
  tip?: string;
  get: (r: ProductResult) => number | string | null;
  render?: (r: ProductResult) => React.ReactNode;
};

const COLS: Col[] = [
  { key: 'name', label: 'Produs', get: (r) => r.product.name.toLowerCase() },
  { key: 'supplierUrl', label: 'URL furnizor', get: (r) => r.product.supplierUrl },
  { key: 'price', label: 'Preț (TVA incl.)', num: true, get: (r) => r.product.sellingPriceGross, render: (r) => fmtRon(r.product.sellingPriceGross) },
  { key: 'cogs', label: 'COGS/unit.', num: true, tip: 'Cost landed per unitate: cost furnizor în RON + inbound + taxă vamală', get: (r) => r.analysis.unit.landedCost, render: (r) => fmtRon(r.analysis.unit.landedCost) },
  { key: 'cpa', label: 'CPA', num: true, get: (r) => r.analysis.inputs.cpa, render: (r) => fmtRon(r.analysis.inputs.cpa) },
  {
    key: 'beCpa',
    label: 'BE CPA',
    num: true,
    tip: 'CPA de break-even (profit net = 0)',
    get: (r) => r.analysis.breakEven.cpaNet,
    render: (r) => <span className={r.analysis.breakEven.cpaNet >= r.analysis.inputs.cpa ? '' : 'neg'}>{fmtRon(r.analysis.breakEven.cpaNet)}</span>,
  },
  { key: 'revenue', label: 'Venit fără TVA', num: true, tip: 'Venit așteptat per comandă plasată, după refuzuri și retururi', get: (r) => r.analysis.revenueExVat, render: (r) => fmtRon(r.analysis.revenueExVat) },
  {
    key: 'contribution',
    label: 'Contribuție',
    num: true,
    get: (r) => r.analysis.contributionProfit,
    render: (r) => <span className={toneOf(r.analysis.contributionProfit) ?? ''}>{fmtRon(r.analysis.contributionProfit)}</span>,
  },
  {
    key: 'net',
    label: 'Profit net',
    num: true,
    get: (r) => r.analysis.netProfit,
    render: (r) => <span className={toneOf(r.analysis.netProfit) ?? ''}>{fmtRon(r.analysis.netProfit)}</span>,
  },
  {
    key: 'margin',
    label: 'Marjă netă',
    num: true,
    get: (r) => r.analysis.netMargin,
    render: (r) => <span className={toneOf(r.analysis.netMargin) ?? ''}>{fmtPct(r.analysis.netMargin)}</span>,
  },
  { key: 'returnRate', label: 'Rată retur', num: true, get: (r) => r.analysis.inputs.returnRate, render: (r) => fmtPct(r.analysis.inputs.returnRate) },
  { key: 'status', label: 'Status', get: (r) => PRODUCT_STATUSES.indexOf(r.product.status), render: (r) => <StatusBadge status={r.product.status} /> },
  { key: 'profitClass', label: 'Profitabilitate', get: (r) => r.profitClass, render: (r) => <ProfitBadge cls={r.profitClass} /> },
  { key: 'updatedAt', label: 'Actualizat', get: (r) => r.product.updatedAt, render: (r) => <span className="muted small">{new Date(r.product.updatedAt).toLocaleDateString('ro-RO')}</span> },
];

export function ProductsPage() {
  const state = useAppState();
  const prefs = state.preferences.productsTable;
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<ProductResult | null>(null);

  const results = useMemo(() => state.products.map((p) => calculateProduct(p, state)), [state]);

  const setPref = (patch: Partial<typeof prefs>) =>
    updatePreferences((p) => ({ ...p, productsTable: { ...p.productsTable, ...patch } }));

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = results.filter((r) => {
      if (prefs.statusFilter !== 'all' && r.product.status !== prefs.statusFilter) return false;
      if (prefs.profitFilter !== 'all' && r.profitClass !== prefs.profitFilter) return false;
      if (!needle) return true;
      return (
        r.product.name.toLowerCase().includes(needle) ||
        r.product.supplierUrl.toLowerCase().includes(needle) ||
        r.product.notes.toLowerCase().includes(needle)
      );
    });
    const col = COLS.find((c) => c.key === prefs.sortKey) ?? COLS[COLS.length - 1];
    const dir = prefs.sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      const va = col.get(a);
      const vb = col.get(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'ro') * dir;
    });
    return list;
  }, [results, q, prefs]);

  const toggleSort = (key: string) => {
    if (prefs.sortKey === key) setPref({ sortDir: prefs.sortDir === 'asc' ? 'desc' : 'asc' });
    else setPref({ sortKey: key, sortDir: key === 'name' || key === 'supplierUrl' ? 'asc' : 'desc' });
  };

  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < 5) n.add(id);
      else toast('Poți compara maxim 5 produse.', 'info');
      return n;
    });

  if (!state.products.length) {
    return (
      <Card>
        <div className="empty">
          <h3>Baza de produse este goală</h3>
          <p>Produsele calculate și salvate apar aici, cu toate metricile.</p>
          <a className="btn primary mt-16" href={href('/produse/nou')}>
            <Icon name="plus" /> Adaugă primul produs
          </a>
        </div>
      </Card>
    );
  }

  return (
    <div className="col gap-16">
      <div className="row wrap" style={{ gap: 10 }}>
        <div className="input-wrap" style={{ width: 280 }}>
          <input className="input" placeholder="Caută după nume, URL, note…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Caută" />
        </div>
        <select
          className="input"
          style={{ width: 160 }}
          value={prefs.statusFilter}
          onChange={(e) => setPref({ statusFilter: e.target.value as ProductStatus | 'all' })}
          aria-label="Filtru status"
        >
          <option value="all">Toate statusurile</option>
          {PRODUCT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className="input"
          style={{ width: 200 }}
          value={prefs.profitFilter}
          onChange={(e) => setPref({ profitFilter: e.target.value as ProfitClass | 'all' })}
          aria-label="Filtru profitabilitate"
        >
          <option value="all">Orice profitabilitate</option>
          <option value="profitable">Profitabile</option>
          <option value="near">Aproape de break-even</option>
          <option value="unprofitable">Neprofitabile</option>
          <option value="unknown">Date insuficiente</option>
        </select>
        <div className="grow" />
        <span className="small muted">
          {rows.length} din {results.length} produse
        </span>
        <button
          className="btn"
          disabled={selected.size < 2}
          onClick={() => navigate(`/comparatie?ids=${[...selected].join(',')}`)}
          title="Selectează 2–5 produse"
        >
          <Icon name="compare" /> Compară ({selected.size})
        </button>
      </div>

      <Card tight>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <span className="sr-only">Selectează</span>
                </th>
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    className={`sortable ${c.num ? 'n' : ''} ${prefs.sortKey === c.key ? 'sorted' : ''}`}
                    onClick={() => toggleSort(c.key)}
                    aria-sort={prefs.sortKey === c.key ? (prefs.sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {c.label}
                    {c.tip && (
                      <span onClick={(e) => e.stopPropagation()} style={{ marginLeft: 4 }}>
                        <Tip>{c.tip}</Tip>
                      </span>
                    )}
                    {prefs.sortKey === c.key && <span> {prefs.sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                ))}
                <th className="n">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product.id}>
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selected.has(r.product.id)}
                      onChange={() => toggleSel(r.product.id)}
                      aria-label={`Selectează ${r.product.name}`}
                    />
                  </td>
                  {COLS.map((c) => (
                    <td key={c.key} className={c.num ? 'n nowrap' : ''}>
                      {c.key === 'name' ? (
                        <a href={href(`/produse/${r.product.id}`)} style={{ color: 'var(--text)', fontWeight: 500 }}>
                          {r.product.name || <span className="muted">Fără nume</span>}
                          {r.warnings.some((w) => w.level === 'error') && (
                            <span title={r.warnings.filter((w) => w.level === 'error').map((w) => w.message).join('\n')} className="neg" style={{ marginLeft: 6 }}>
                              ⚠
                            </span>
                          )}
                        </a>
                      ) : c.key === 'supplierUrl' ? (
                        safeUrl(r.product.supplierUrl) ? (
                          <a href={safeUrl(r.product.supplierUrl)!} target="_blank" rel="noreferrer noopener" className="small ellipsis" style={{ display: 'inline-block', maxWidth: 160 }} title={r.product.supplierUrl}>
                            {shortUrl(r.product.supplierUrl)}
                          </a>
                        ) : (
                          <span className="muted">—</span>
                        )
                      ) : c.render ? (
                        c.render(r)
                      ) : (
                        String(c.get(r) ?? '—')
                      )}
                    </td>
                  ))}
                  <td className="n nowrap">
                    <button className="btn icon ghost" title="Detalii" onClick={() => navigate(`/produse/${r.product.id}`)}>
                      <Icon name="eye" />
                    </button>
                    <button className="btn icon ghost" title="Editează" onClick={() => navigate(`/produse/${r.product.id}/editare`)}>
                      <Icon name="edit" />
                    </button>
                    <button
                      className="btn icon ghost"
                      title="Duplică"
                      onClick={() => {
                        duplicateProduct(r.product.id);
                        toast('Produs duplicat.');
                      }}
                    >
                      <Icon name="copy" />
                    </button>
                    <button className="btn icon ghost" title="Șterge" onClick={() => setConfirmDelete(r)}>
                      <Icon name="trash" />
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={COLS.length + 2} className="muted" style={{ textAlign: 'center', padding: 30 }}>
                    Niciun produs nu corespunde filtrelor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {confirmDelete && (
        <ConfirmDialog
          title="Ștergi produsul?"
          danger
          confirmLabel="Șterge definitiv"
          message={
            <>
              Produsul <b>{confirmDelete.product.name || 'Fără nume'}</b> și scenariile salvate pentru el vor fi șterse. Acțiunea nu poate fi anulată
              (decât prin importul unui backup JSON).
            </>
          }
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            deleteProduct(confirmDelete.product.id);
            setSelected((s) => {
              const n = new Set(s);
              n.delete(confirmDelete.product.id);
              return n;
            });
            setConfirmDelete(null);
            toast('Produs șters.');
          }}
        />
      )}
    </div>
  );
}

export function shortUrl(u: string): string {
  try {
    const url = new URL(u);
    return url.hostname.replace(/^www\./, '') + (url.pathname.length > 1 ? url.pathname.slice(0, 18) + (url.pathname.length > 18 ? '…' : '') : '');
  } catch {
    return u.slice(0, 30);
  }
}
