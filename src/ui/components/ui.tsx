import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { parseNumberInput, toInputString } from '../../utils/format';
import type { ProfitClass, ProductStatus } from '../../domain/types';
import { PROFIT_CLASS_LABEL } from '../../domain/engine';
import type { EngineWarning, ValueSource } from '../../domain/engine';

/* ---------------- Tooltip ---------------- */

export function Tip({ children, label = 'i' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !ref.current || !bubble.current) return;
    const r = ref.current.getBoundingClientRect();
    const b = bubble.current.getBoundingClientRect();
    let left = r.left + r.width / 2 - b.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - b.width - 8));
    let top = r.bottom + 8;
    if (top + b.height > window.innerHeight - 8) top = r.top - b.height - 8;
    setPos({ left, top });
  }, [open]);

  return (
    <span className="tip">
      <button
        type="button"
        ref={ref}
        className="tip-trigger"
        aria-label="Detalii"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {label}
      </button>
      {open &&
        createPortal(
          <div ref={bubble} className="tip-bubble" style={{ left: pos.left, top: pos.top }} role="tooltip">
            {children}
          </div>,
          document.body,
        )}
    </span>
  );
}

/* ---------------- Number input ---------------- */

interface NumberFieldProps {
  label?: ReactNode;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  /** Dacă true, valoarea afișată e procent (×100), iar cea stocată e fracție. */
  percent?: boolean;
  suffix?: string;
  placeholder?: string;
  hint?: ReactNode;
  tip?: ReactNode;
  allowEmpty?: boolean;
  min?: number;
  max?: number;
  autoFocus?: boolean;
  size?: 'lg';
  highlight?: boolean;
  id?: string;
  disabled?: boolean;
}

export function NumberField({
  label,
  value,
  onChange,
  percent,
  suffix,
  placeholder,
  hint,
  tip,
  allowEmpty,
  min = 0,
  max,
  autoFocus,
  size,
  highlight,
  id,
  disabled,
}: NumberFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const display = (v: number | null | undefined) =>
    v === null || v === undefined ? '' : toInputString(percent ? v * 100 : v, percent ? 4 : 6);
  const [text, setText] = useState(display(value));
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);

  // sincronizare când valoarea se schimbă din exterior
  useEffect(() => {
    if (!focused.current) {
      setText(display(value));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, percent]);

  const commit = (raw: string) => {
    setText(raw);
    if (raw.trim() === '') {
      if (allowEmpty) {
        setError(null);
        onChange(null);
      } else {
        setError('Câmp obligatoriu – se folosește 0');
        onChange(0);
      }
      return;
    }
    const n = parseNumberInput(raw);
    if (n === null) {
      setError('Număr invalid – ultima valoare validă este păstrată');
      return;
    }
    const maxV = max ?? (percent ? 100 : undefined);
    if (n < min) {
      setError(`Minim ${min}${percent ? '%' : ''}`);
      return;
    }
    if (maxV !== undefined && n > maxV) {
      setError(`Maxim ${maxV}${percent ? '%' : ''}`);
      return;
    }
    setError(null);
    onChange(percent ? n / 100 : n);
  };

  const sfx = percent ? '%' : suffix;
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={inputId}>
          {label}
          {tip && <Tip>{tip}</Tip>}
        </label>
      )}
      <div className="input-wrap">
        <input
          id={inputId}
          className={`input ${sfx ? 'has-suffix' : ''} ${error ? 'invalid' : ''} ${highlight ? 'overridden' : ''} ${size === 'lg' ? 'lg' : ''}`}
          inputMode="decimal"
          value={text}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false;
            if (!error) setText(display(value));
          }}
          onChange={(e) => commit(e.target.value)}
        />
        {sfx && <span className="suffix">{sfx}</span>}
      </div>
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  tip,
  autoFocus,
  type = 'text',
  size,
}: {
  label?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  tip?: ReactNode;
  autoFocus?: boolean;
  type?: string;
  size?: 'lg';
}) {
  const id = useId();
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
          {tip && <Tip>{tip}</Tip>}
        </label>
      )}
      <input
        id={id}
        type={type}
        className={`input ${size === 'lg' ? 'lg' : ''}`}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  tip,
  hint,
}: {
  label?: ReactNode;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  tip?: ReactNode;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
          {tip && <Tip>{tip}</Tip>}
        </label>
      )}
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      <span>{label}</span>
    </label>
  );
}

/* ---------------- KPI ---------------- */

export function Kpi({
  label,
  value,
  sub,
  tone,
  tip,
  size,
  accent,
  compact,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'pos' | 'neg' | null;
  tip?: ReactNode;
  size?: 'lg';
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`kpi ${tone ?? ''} ${accent ? 'accent' : ''} ${compact ? 'compact' : ''}`}>
      <div className="kpi-label">
        {label}
        {tip && <Tip>{tip}</Tip>}
      </div>
      <div className={`kpi-value num ${size === 'lg' ? 'lg' : ''}`}>{value}</div>
      {sub !== undefined && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function toneOf(v: number | null | undefined): 'pos' | 'neg' | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  if (Math.abs(v) < 0.005) return null;
  return v > 0 ? 'pos' : 'neg';
}

/* ---------------- Badges ---------------- */

const CLASS_TONE: Record<ProfitClass, string> = { profitable: 'pos', near: 'near', unprofitable: 'neg', unknown: 'neutral' };

export function ProfitBadge({ cls }: { cls: ProfitClass }) {
  return (
    <span className={`badge ${CLASS_TONE[cls]}`}>
      <span className="dot" />
      {PROFIT_CLASS_LABEL[cls]}
    </span>
  );
}

export const STATUS_LABEL: Record<ProductStatus, string> = {
  idee: 'Idee',
  testare: 'Testare',
  activ: 'Activ',
  scalare: 'Scalare',
  oprit: 'Oprit',
};
const STATUS_TONE: Record<ProductStatus, string> = { idee: 'neutral', testare: 'info', activ: 'accent', scalare: 'pos', oprit: 'neutral' };

export function StatusBadge({ status }: { status: ProductStatus }) {
  return <span className={`badge ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

const SOURCE_META: Record<ValueSource, { cls: string; label: string }> = {
  produs: { cls: 'product', label: 'produs' },
  override: { cls: 'override', label: 'override' },
  setări: { cls: 'settings', label: 'setări' },
  implicit: { cls: 'settings', label: 'implicit' },
  lipsă: { cls: 'missing', label: '0 · neconfigurat' },
};

export function SourceTag({ source }: { source: ValueSource | undefined }) {
  if (!source) return null;
  const m = SOURCE_META[source];
  return <span className={`source-tag ${m.cls}`}>{m.label}</span>;
}

/* ---------------- Alerts ---------------- */

export function Alert({ level, children }: { level: 'error' | 'warning' | 'info' | 'success'; children: ReactNode }) {
  return (
    <div className={`alert ${level}`} role={level === 'error' ? 'alert' : undefined}>
      <Icon name={level === 'info' ? 'info' : level === 'success' ? 'check' : 'alert'} />
      <div>{children}</div>
    </div>
  );
}

export function Warnings({ warnings, filter }: { warnings: EngineWarning[]; filter?: EngineWarning['level'][] }) {
  const list = filter ? warnings.filter((w) => filter.includes(w.level)) : warnings;
  if (!list.length) return null;
  return (
    <div className="alerts">
      {list.map((w, i) => (
        <Alert key={i} level={w.level}>
          {w.message}
        </Alert>
      ))}
    </div>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({
  title,
  children,
  onClose,
  footer,
  width,
}: {
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" style={width ? { maxWidth: width } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmă',
  danger,
  requireText,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Dacă e setat, utilizatorul trebuie să tasteze textul pentru a confirma. */
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const ok = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn ghost" onClick={onCancel}>
            Anulează
          </button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} disabled={!ok} onClick={onConfirm} autoFocus={!requireText}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div>{message}</div>
      {requireText && (
        <div className="mt-16">
          <TextField
            label={
              <>
                Tastează <span className="kbd">{requireText}</span> pentru confirmare
              </>
            }
            value={typed}
            onChange={setTyped}
            autoFocus
          />
        </div>
      )}
    </Modal>
  );
}

/* ---------------- Toasts ---------------- */

type ToastItem = { id: number; message: ReactNode; kind: 'success' | 'error' | 'info' };
let toastListeners: ((t: ToastItem[]) => void)[] = [];
let toasts: ToastItem[] = [];
let toastSeq = 0;

export function toast(message: ReactNode, kind: ToastItem['kind'] = 'success') {
  const id = ++toastSeq;
  toasts = [...toasts, { id, message, kind }];
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    toastListeners.forEach((l) => l(toasts));
  }, kind === 'error' ? 6000 : 3000);
}

export function Toasts() {
  const [list, setList] = useState<ToastItem[]>(toasts);
  useEffect(() => {
    toastListeners.push(setList);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== setList);
    };
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'info' ? 'info' : 'check'} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Card ---------------- */

export function Card({
  title,
  sub,
  actions,
  children,
  tight,
  className,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  tight?: boolean;
  className?: string;
}) {
  return (
    <section className={`card ${className ?? ''}`}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <div className="sub">{sub}</div>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={`card-body ${tight ? 'tight' : ''}`}>{children}</div>
    </section>
  );
}
