import { useRef, useState } from 'react';
import { buildExport, exportFileName, parseImport, type ImportResult } from '../../persistence/exportImport';
import { flushSave, getState, replaceState, resetApplication, useStore } from '../../state/store';
import { updatePreferences } from '../../state/actions';
import { createDemoState } from '../../domain/demo';
import { APP_VERSION, SCHEMA_VERSION } from '../../domain/defaults';
import { INTEGRATIONS } from '../../integrations/registry';
import { href } from '../../state/router';
import { fmtDateTime, fmtRelative } from '../../utils/format';
import { Icon } from '../components/Icon';
import { Alert, Card, ConfirmDialog, Modal, toast } from '../components/ui';

function backupStatus(lastExportAt: string | null, lastChangeAt: string | null): { tone: 'pos' | 'warn' | 'neg'; label: string } {
  if (!lastExportAt) return { tone: 'neg', label: 'Niciun backup exportat' };
  if (lastChangeAt && new Date(lastChangeAt) > new Date(lastExportAt)) return { tone: 'warn', label: `Modificări neexportate · backup ${fmtRelative(lastExportAt)}` };
  return { tone: 'pos', label: `Backup la zi · ${fmtRelative(lastExportAt)}` };
}

export function BackupPill() {
  const { state, meta } = useStore();
  const st = backupStatus(state.preferences.lastExportAt, meta.lastChangeAt);
  return (
    <a href={href('/date')} className="pill" style={{ whiteSpace: 'normal', textDecoration: 'none' }} title="Date & backup">
      <span className={`dot ${st.tone === 'pos' ? 'pos' : st.tone === 'warn' ? 'warn' : 'neg'}`} />
      <span>
        {st.label}
        <br />
        <span className="xs muted">{meta.available ? `Salvat local ${fmtRelative(meta.lastSavedAt)}` : 'Salvare locală indisponibilă'}</span>
      </span>
    </a>
  );
}

export function downloadExport() {
  const now = new Date();
  updatePreferences((p) => ({ ...p, lastExportAt: now.toISOString() }));
  // starea actualizată (cu lastExportAt) intră în fișier
  flushSave();
  const state = getState();
  const blob = new Blob([JSON.stringify(buildExport(state, now), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(now);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


export function DataPage() {
  const { state, meta } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<(ImportResult & { ok: true }) | null>(null);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const st = backupStatus(state.preferences.lastExportAt, meta.lastChangeAt);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setImportErrors(null);
    if (f.size > 20 * 1024 * 1024) {
      setImportErrors(['Fișierul este prea mare (peste 20 MB).']);
      return;
    }
    const text = await f.text();
    const res = parseImport(text);
    if (res.ok) setPending(res);
    else setImportErrors(res.errors);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="col gap-16">
      <div className="grid grid-3">
        <div className="kpi">
          <div className="kpi-label">Status backup</div>
          <div className="row mt-8">
            <span className={`badge ${st.tone === 'pos' ? 'pos' : st.tone === 'warn' ? 'near' : 'neg'}`}>
              <span className="dot" />
              {st.label}
            </span>
          </div>
          <div className="kpi-sub">Ultimul export: {fmtDateTime(state.preferences.lastExportAt)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Salvare automată locală</div>
          <div className="kpi-value" style={{ fontSize: 16 }}>{meta.available ? 'Activă' : 'Indisponibilă'}</div>
          <div className="kpi-sub">Ultima salvare: {fmtDateTime(meta.lastSavedAt)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Conținut</div>
          <div className="kpi-value" style={{ fontSize: 16 }}>
            {state.products.length} produse · {state.scenarios.length} scenarii
          </div>
          <div className="kpi-sub">
            Aplicație v{APP_VERSION} · schemă v{SCHEMA_VERSION}
          </div>
        </div>
      </div>

      <Alert level="info">
        Datele se salvează automat în acest browser. <b>Exportul JSON</b> este backup-ul tău portabil: îl poți importa pe alt calculator sau în alt
        browser și restaurează complet aplicația (setări, costuri, produse, override-uri, scenarii, preferințe). Datele locale se pierd dacă ștergi
        datele browserului – exportă regulat.
      </Alert>

      <div className="grid grid-2">
        <Card title="Export date" sub="Descarcă întreaga stare a aplicației ca fișier JSON">
          <p className="small text-2" style={{ marginTop: 0 }}>
            Include: versiunea aplicației, <code>schemaVersion</code>, informații companie, taxe, cursuri valutare, costuri fixe, costuri variabile,
            retururi/refuzuri, alocare, toate produsele cu override-uri și costuri specifice, scenarii salvate și preferințe.
          </p>
          <button className="btn primary" onClick={() => { downloadExport(); toast('Backup exportat.'); }}>
            <Icon name="download" /> Exportă tot (JSON)
          </button>
        </Card>

        <Card title="Import date" sub="Restaurează dintr-un backup JSON">
          <p className="small text-2" style={{ marginTop: 0 }}>
            Fișierul este validat complet înainte de import. Dacă este invalid, vei vedea exact ce e greșit, iar datele existente rămân neatinse.
          </p>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> Alege fișier JSON…
          </button>
          {importErrors && (
            <div className="mt-16">
              <Alert level="error">
                <b>Importul a fost oprit – datele tale NU au fost modificate.</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {importErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </Alert>
            </div>
          )}
        </Card>
      </div>

      <Card title="Zonă periculoasă">
        <div className="row wrap between">
          <div>
            <b>Încarcă date demo</b>
            <div className="small muted">Înlocuiește toate datele cu un set demonstrativ (costuri fictive, marcate DEMO).</div>
          </div>
          <button className="btn" onClick={() => setConfirmDemo(true)}>
            Încarcă demo
          </button>
        </div>
        <div className="divider" />
        <div className="row wrap between">
          <div>
            <b>Resetează aplicația</b>
            <div className="small muted">Șterge toate produsele, setările și scenariile din acest browser.</div>
          </div>
          <button className="btn danger" onClick={() => setConfirmReset(true)}>
            <Icon name="trash" /> Resetează
          </button>
        </div>
      </Card>

      <Card title="Integrări" sub="Arhitectura permite conectarea ulterioară a surselor de date reale">
        <div className="grid grid-3">
          {INTEGRATIONS.map((i) => (
            <div key={i.id} className="kpi compact">
              <div className="row between">
                <b>{i.name}</b>
                <span className="badge neutral">neconectat</span>
              </div>
              <div className="small muted mt-8">{i.description}</div>
            </div>
          ))}
        </div>
        <div className="small muted mt-16">Aplicația funcționează complet fără integrări. Datele introduse manual rămân sursa de adevăr.</div>
      </Card>

      {pending && (
        <Modal
          title="Confirmă importul"
          onClose={() => setPending(null)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setPending(null)}>
                Anulează
              </button>
              <button className="btn" onClick={() => downloadExport()}>
                <Icon name="download" /> Exportă întâi datele curente
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  replaceState(pending.state);
                  setPending(null);
                  setImportErrors(null);
                  toast('Date importate cu succes.');
                }}
              >
                Înlocuiește datele
              </button>
            </>
          }
          width={560}
        >
          <p style={{ marginTop: 0 }}>Fișier valid. Importul va <b>înlocui complet</b> datele actuale.</p>
          <div className="formula-box">
            <div>Produse: <b>{pending.summary.products}</b> (acum: {state.products.length})</div>
            <div>Scenarii: <b>{pending.summary.scenarios}</b></div>
            <div>Categorii costuri fixe: <b>{pending.summary.fixedCosts}</b></div>
            <div>Versiune aplicație: <b>{pending.meta.version ?? 'necunoscută'}</b> · schemă v{pending.meta.schemaVersion}</div>
            <div>Exportat la: <b>{fmtDateTime(pending.meta.exportedAt)}</b></div>
          </div>
        </Modal>
      )}

      {confirmReset && (
        <ConfirmDialog
          title="Resetezi aplicația?"
          danger
          requireText="RESET"
          confirmLabel="Șterge tot"
          message={
            <>
              Toate cele {state.products.length} produse, setările și scenariile vor fi șterse din acest browser. Recomandat: exportă un backup JSON
              înainte.
            </>
          }
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            resetApplication();
            setConfirmReset(false);
            toast('Aplicația a fost resetată.');
          }}
        />
      )}

      {confirmDemo && (
        <ConfirmDialog
          title="Încarci datele demo?"
          danger
          confirmLabel="Înlocuiește cu demo"
          message={<>Datele actuale ({state.products.length} produse) vor fi înlocuite. Exportă un backup înainte dacă vrei să le păstrezi.</>}
          onCancel={() => setConfirmDemo(false)}
          onConfirm={() => {
            replaceState(createDemoState());
            setConfirmDemo(false);
            toast('Date demo încărcate.');
          }}
        />
      )}
    </div>
  );
}
