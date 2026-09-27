import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { fmtRon } from '../../utils/format';

/** Paletă categorială (pas „dark”) – ordine fixă, validată pentru CVD. */
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767', '#6d7689'];

/** Lățimea reală a containerului – graficele se desenează la scară 1:1 (text lizibil). */
function useWidth(fallback = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(280, Math.round(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

function useChartTip() {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);
  const node = tip
    ? createPortal(
        <div
          className="chart-tip"
          style={{ left: Math.min(tip.x + 14, window.innerWidth - 260), top: tip.y + 14 }}
        >
          {tip.content}
        </div>,
        document.body,
      )
    : null;
  return { setTip, node };
}

/* ---------------- Bare orizontale divergente ---------------- */

export interface HBarItem {
  key: string;
  label: string;
  value: number;
  display?: string;
  tooltip?: ReactNode;
  onClick?: () => void;
}

export function HBarChart({ items, format = (v) => fmtRon(v, { decimals: 0 }) }: { items: HBarItem[]; format?: (v: number) => string }) {
  const { setTip, node } = useChartTip();
  const { ref, w: W } = useWidth();
  if (!items.length) return <div className="muted small">Nu există date.</div>;
  const rowH = 30;
  const labelW = Math.min(190, Math.round(W * 0.34));
  const valueW = 96;
  const plotW = W - labelW - valueW;
  const maxPos = Math.max(0, ...items.map((i) => i.value));
  const maxNeg = Math.max(0, ...items.map((i) => -i.value));
  const span = maxPos + maxNeg || 1;
  const zeroX = labelW + (maxNeg / span) * plotW;
  const H = items.length * rowH + 8;
  const maxChars = Math.max(8, Math.floor(labelW / 6.6));
  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafic cu bare">
        <line x1={zeroX} x2={zeroX} y1={0} y2={H} className="axis" />
        {items.map((it, idx) => {
          const y = idx * rowH + 4;
          const w = (Math.abs(it.value) / span) * plotW;
          const x = it.value >= 0 ? zeroX : zeroX - w;
          const color = it.value >= 0 ? 'var(--pos)' : 'var(--neg)';
          const bh = 14;
          const by = y + (rowH - bh) / 2;
          const r = Math.min(4, w / 2);
          // capăt rotunjit doar la extremitatea datelor
          const path =
            it.value >= 0
              ? `M${x},${by} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${bh - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - r} z`
              : `M${x + w},${by} h-${w - r} a${r},${r} 0 0 0 -${r},${r} v${bh - 2 * r} a${r},${r} 0 0 0 ${r},${r} h${w - r} z`;
          return (
            <g
              key={it.key}
              style={{ cursor: it.onClick ? 'pointer' : 'default' }}
              onClick={it.onClick}
              onMouseMove={(e) =>
                setTip({
                  x: e.clientX,
                  y: e.clientY,
                  content: it.tooltip ?? (
                    <>
                      <b>{it.label}</b>
                      <div>{it.display ?? format(it.value)}</div>
                    </>
                  ),
                })
              }
              onMouseLeave={() => setTip(null)}
            >
              <rect x={0} y={y} width={W} height={rowH} fill="transparent" />
              <text x={labelW - 10} y={y + rowH / 2 + 4} textAnchor="end" className="lbl">
                {it.label.length > maxChars ? `${it.label.slice(0, maxChars - 1)}…` : it.label}
              </text>
              {w > 0.5 && <path d={path} fill={color} />}
              <text x={W - 4} y={y + rowH / 2 + 4} textAnchor="end" className="val">
                {it.display ?? format(it.value)}
              </text>
            </g>
          );
        })}
      </svg>
      {node}
    </div>
  );
}

/* ---------------- Bară stivuită (compoziția venitului) ---------------- */

export interface StackSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function StackBar({ segments, total, format = (v: number) => fmtRon(v) }: { segments: StackSegment[]; total: number; format?: (v: number) => string }) {
  const { setTip, node } = useChartTip();
  const positive = segments.filter((s) => s.value > 0);
  const sumPos = positive.reduce((a, s) => a + s.value, 0);
  const denom = Math.max(total, sumPos) || 1;
  return (
    <div>
      <div className="stack-bar" role="img" aria-label="Compoziția venitului">
        {positive.map((s) => (
          <div
            key={s.key}
            style={{ width: `${(s.value / denom) * 100}%`, background: s.color }}
            onMouseMove={(e) =>
              setTip({
                x: e.clientX,
                y: e.clientY,
                content: (
                  <>
                    <b>{s.label}</b>
                    <div>
                      {format(s.value)} · {total > 0 ? `${((s.value / total) * 100).toFixed(1).replace('.', ',')}% din venit` : '—'}
                    </div>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTip(null)}
          />
        ))}
      </div>
      <div className="legend mt-8">
        {segments.map((s) => (
          <span key={s.key}>
            <span className="sw" style={{ background: s.color }} />
            {s.label}: <span className="num" style={{ color: 'var(--text)' }}>{format(s.value)}</span>
          </span>
        ))}
      </div>
      {node}
    </div>
  );
}

/* ---------------- Linie profit vs CPA ---------------- */

export function ProfitCurve({
  points,
  currentX,
  breakEvenX,
  xLabel,
  format = (v: number) => fmtRon(v),
}: {
  points: { x: number; y: number }[];
  currentX?: number;
  breakEvenX?: number | null;
  xLabel: string;
  format?: (v: number) => string;
}) {
  const { setTip, node } = useChartTip();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const { ref, w: W } = useWidth();
  if (points.length < 2) return <div ref={ref} />;
  const H = 220;
  const pad = { l: 64, r: 16, t: 12, b: 30 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let y0 = Math.min(0, ...ys);
  let y1 = Math.max(0, ...ys);
  if (y1 - y0 < 1e-9) {
    y0 -= 1;
    y1 += 1;
  }
  const px = (x: number) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (W - pad.l - pad.r);
  const py = (y: number) => pad.t + (1 - (y - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => y0 + ((y1 - y0) * i) / ticks);
  const xTicks = Array.from({ length: 6 }, (_, i) => x0 + ((x1 - x0) * i) / 5);
  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="chart" ref={ref}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Profit în funcție de CPA"
        onMouseMove={(e) => {
          const svg = svgRef.current;
          if (!svg) return;
          const rect = svg.getBoundingClientRect();
          const mx = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          let bd = Infinity;
          points.forEach((p, i) => {
            const dd = Math.abs(px(p.x) - mx);
            if (dd < bd) {
              bd = dd;
              best = i;
            }
          });
          setHover(best);
          const p = points[best];
          setTip({
            x: e.clientX,
            y: e.clientY,
            content: (
              <>
                <div>
                  {xLabel}: <b>{fmtRon(p.x)}</b>
                </div>
                <div>
                  Profit net/comandă: <b className={p.y >= 0 ? 'pos' : 'neg'}>{format(p.y)}</b>
                </div>
              </>
            ),
          });
        }}
        onMouseLeave={() => {
          setHover(null);
          setTip(null);
        }}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={py(t)} y2={py(t)} className="gridline" />
            <text x={pad.l - 8} y={py(t) + 4} textAnchor="end">
              {fmtRon(t, { decimals: 0 }).replace(' lei', '')}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={px(t)} y={H - 10} textAnchor="middle">
            {fmtRon(t, { decimals: 0 }).replace(' lei', '')}
          </text>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={py(0)} y2={py(0)} className="axis" />
        {/* zonă profit/pierdere */}
        <path d={`${d} L${px(x1)},${py(0)} L${px(x0)},${py(0)} Z`} fill="var(--accent)" opacity={0.08} />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {breakEvenX !== null && breakEvenX !== undefined && breakEvenX >= x0 && breakEvenX <= x1 && (
          <g>
            <line x1={px(breakEvenX)} x2={px(breakEvenX)} y1={pad.t} y2={H - pad.b} stroke="var(--warn)" strokeWidth={1} />
            <text x={px(breakEvenX) + 4} y={pad.t + 10} style={{ fill: 'var(--warn)' }}>
              break-even
            </text>
          </g>
        )}
        {currentX !== undefined && currentX >= x0 && currentX <= x1 && (
          <g>
            <line x1={px(currentX)} x2={px(currentX)} y1={pad.t} y2={H - pad.b} stroke="var(--text-2)" strokeWidth={1} />
            <text x={px(currentX) + 4} y={pad.t + 26} className="lbl">
              CPA curent
            </text>
          </g>
        )}
        {hp && (
          <g>
            <line x1={px(hp.x)} x2={px(hp.x)} y1={pad.t} y2={H - pad.b} stroke="var(--border-strong)" />
            <circle cx={px(hp.x)} cy={py(hp.y)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {node}
    </div>
  );
}
