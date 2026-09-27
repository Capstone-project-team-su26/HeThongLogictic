/*
 * Mảnh biểu đồ dùng chung cho bảng tổng quan vận hành và quản trị.
 *
 * admin-ui không cài thư viện biểu đồ nào (SaleDashboard cũng tự vẽ SVG), nên ở đây vẽ bằng
 * SVG/CSS thuần: một trục, nét mảnh, màu theo thứ tự cố định của series (không theo hạng),
 * nhãn chữ dùng màu mực chứ không dùng màu series, rê chuột có tooltip (<title> / title).
 * Không mảnh nào tự tính số liệu — mọi con số do backend trả.
 */
import "./DashboardCharts.css";

import { SERIES_COLORS, formatCount } from "./dashboardFormat";

/* ───────────────────────── Thẻ số ───────────────────────── */

export function StatTile({ label, value, hint, title, tone = "default" }) {
  return (
    <div className={`dash-stat dash-stat--${tone}`} title={title}>
      <span className="dash-stat__label">{label}</span>
      <strong className="dash-stat__value">{value}</strong>
      {hint ? <small className="dash-stat__hint">{hint}</small> : null}
    </div>
  );
}

/* ───────────────────────── Khung thẻ ───────────────────────── */

export function ChartCard({ title, subtitle, children, extra }) {
  return (
    <section className="dash-card">
      <header className="dash-card__head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {extra}
      </header>
      {children}
    </section>
  );
}

/* ───────────────────────── Chú giải ───────────────────────── */

export function Legend({ series }) {
  if (!series || series.length < 2) return null;
  return (
    <ul className="dash-legend">
      {series.map((s, index) => (
        <li key={s.key}>
          <span className="dash-legend__swatch" style={{ background: s.color ?? SERIES_COLORS[index] }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────── Thanh ngang ───────────────────────── */

/**
 * Danh sách thanh ngang: độ dài theo `value / max` (hoặc theo `percent` nếu truyền `usePercent`).
 * @param {{ rows: Array<{ key, label, value, valueText?, percent?, title? }>, color?, usePercent?, emptyText? }} props
 */
export function BarList({ rows, color = SERIES_COLORS[0], usePercent = false, emptyText = "Chưa có dữ liệu." }) {
  const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0));

  if (rows.length === 0) return <p className="dash-empty">{emptyText}</p>;

  return (
    <ul className="dash-bars">
      {rows.map((row) => {
        const width = usePercent ? Math.min(100, Number(row.percent) || 0) : ((Number(row.value) || 0) / max) * 100;
        return (
          <li key={row.key} title={row.title ?? `${row.label}: ${row.valueText ?? formatCount(row.value)}`}>
            <div className="dash-bars__head">
              <span>{row.label}</span>
              <strong>{row.valueText ?? formatCount(row.value)}</strong>
            </div>
            <div className="dash-bars__track">
              <div className="dash-bars__fill" style={{ width: `${width}%`, background: row.color ?? color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────────────────── Cột nhóm ───────────────────────── */

const CHART_W = 560;
const CHART_H = 200;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 18;
const PAD_B = 26;

/**
 * Cột nhóm theo trục thời gian — một trục y duy nhất cho mọi series.
 * @param {{ data: object[], xKey: string, xLabel: (v) => string, series: Array<{ key, label, color? }>, format?: (v) => string, ariaLabel: string }} props
 */
export function ColumnChart({ data, xKey, xLabel, series, format = formatCount, ariaLabel }) {
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;
  const groupW = data.length ? plotW / data.length : plotW;
  const gap = 2;
  const barW = Math.max(4, Math.min(28, (groupW * 0.7 - gap * (series.length - 1)) / series.length));
  const groupInner = barW * series.length + gap * (series.length - 1);
  const baseline = PAD_T + plotH;

  return (
    <div className="dash-columns">
      <Legend series={series.map((s, i) => ({ ...s, color: s.color ?? SERIES_COLORS[i] }))} />
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={ariaLabel} className="dash-columns__svg">
        <line x1={PAD_L} x2={CHART_W - PAD_R} y1={PAD_T} y2={PAD_T} className="dash-grid" />
        <line x1={PAD_L} x2={CHART_W - PAD_R} y1={PAD_T + plotH / 2} y2={PAD_T + plotH / 2} className="dash-grid" />
        <text x={PAD_L} y={PAD_T - 6} className="dash-axis-text">{format(max)}</text>

        {data.map((d, gi) => {
          const x0 = PAD_L + gi * groupW + (groupW - groupInner) / 2;
          const tip = `${xLabel(d[xKey])}\n${series.map((s) => `${s.label}: ${format(d[s.key])}`).join("\n")}`;
          return (
            <g key={d[xKey]}>
              <title>{tip}</title>
              {/* vùng rê chuột rộng hơn cột */}
              <rect x={PAD_L + gi * groupW} y={PAD_T} width={groupW} height={plotH} className="dash-hit" />
              {series.map((s, si) => {
                const v = Number(d[s.key]) || 0;
                const h = v > 0 ? Math.max(2, (v / max) * plotH) : 0;
                return (
                  <path
                    key={s.key}
                    d={roundedTopBar(x0 + si * (barW + gap), baseline, barW, h)}
                    fill={s.color ?? SERIES_COLORS[si]}
                  />
                );
              })}
              <text x={PAD_L + gi * groupW + groupW / 2} y={CHART_H - 8} textAnchor="middle" className="dash-axis-text">
                {xLabel(d[xKey])}
              </text>
            </g>
          );
        })}
        <line x1={PAD_L} x2={CHART_W - PAD_R} y1={baseline} y2={baseline} className="dash-baseline" />
      </svg>
    </div>
  );
}

/** Cột đứng trên đường đáy, bo 4px ở đầu cột (không bo chân cột). */
function roundedTopBar(x, baseline, w, h) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  const top = baseline - h;
  return `M${x},${baseline} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${baseline} Z`;
}
