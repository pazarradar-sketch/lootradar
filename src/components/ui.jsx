import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

export function Sparkline({ points = [], w = 120, h = 36, up }) {
  const ys = points.map((p) => (Array.isArray(p) ? p[1] : p)).filter((v) => v != null);
  if (ys.length < 2) return <svg width={w} height={h} className="opacity-30"><line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="currentColor" strokeDasharray="3 3" /></svg>;
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const pts = ys.map((v, i) => `${(i / (ys.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`).join(" ");
  const color = up == null ? "#6366f1" : up ? "#10b981" : "#f43f5e";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs><linearGradient id="sg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill="url(#sg)" stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Delta({ v, className = "" }) {
  if (v == null || !Number.isFinite(v)) return <span className={`text-slate-400 ${className}`}>—</span>;
  const cls = v > 0.05 ? "text-emerald-600 dark:text-emerald-400" : v < -0.05 ? "text-rose-600 dark:text-rose-400" : "text-slate-500";
  return <span className={`num font-semibold ${cls} ${className}`}>{v > 0 ? "+" : ""}{v.toFixed(1)}%</span>;
}

export function TrendChip({ trend, t }) {
  const m = { up: ["chip-up", "▲"], down: ["chip-down", "▼"], flat: ["chip-flat", "■"] }[trend] || ["chip-flat", "·"];
  return <span className={m[0]}>{m[1]} {t.sig[trend] || "—"}</span>;
}
export function StanceChip({ stance, confidence, t }) {
  const m = { buy: "chip-up", sell: "chip-down", hold: "chip-flat" }[stance] || "chip-flat";
  return <span className={m} title={t.sig[confidence] || ""}>{t.sig[stance] || "—"}{confidence === "low" ? " ?" : ""}</span>;
}

export function Stat({ label, value, sub, accent }) {
  return (
    <div className="card p-4 fade-in">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold num ${accent ? "brand-text" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  );
}

export function Section({ title, sub, right, children, id }) {
  return (
    <section id={id} className="mt-8 fade-in">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="text-lg font-bold tracking-tight">{title}</h2>{sub && <p className="mt-0.5 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{sub}</p>}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function LineChart({ datasets, labels, fmtY, height = 240 }) {
  const ref = useRef(null); const inst = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const dark = document.documentElement.classList.contains("dark");
    const grid = dark ? "rgba(148,163,184,.12)" : "rgba(15,23,42,.06)", tick = dark ? "#94a3b8" : "#64748b";
    inst.current?.destroy();
    inst.current = new Chart(ref.current, {
      type: "line",
      data: { labels, datasets: datasets.map((d, i) => ({ tension: .25, pointRadius: labels.length > 80 ? 0 : 2.5, borderWidth: 2, fill: false, ...d })) },
      options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false },
        scales: { x: { grid: { color: grid }, ticks: { color: tick, maxTicksLimit: 8, maxRotation: 0 } }, y: { grid: { color: grid }, ticks: { color: tick, callback: (v) => fmtY ? fmtY(v) : v } } },
        plugins: { legend: { position: "bottom", labels: { color: tick, boxWidth: 10, usePointStyle: true } }, tooltip: { callbacks: { label: (it) => `${it.dataset.label}: ${fmtY ? fmtY(it.raw, 2) : it.raw}` } } } },
    });
    return () => inst.current?.destroy();
  }, [datasets, labels, fmtY]);
  return <div style={{ height }}><canvas ref={ref} /></div>;
}

export function Select({ label, value, onChange, options, className = "" }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</select>
    </label>
  );
}
export function Input({ label, className = "", ...p }) {
  return <label className={`block ${className}`}>{label && <span className="label">{label}</span>}<input className="input" {...p} /></label>;
}
export const Empty = ({ children }) => <div className="card p-8 text-center text-sm text-slate-500 dark:text-slate-400">{children}</div>;
