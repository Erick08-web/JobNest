"use client";

import type { ReactNode } from "react";
import { AlertTriangle, BarChart3, Info, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { AnalyticsDistributionItem, AnalyticsKpi, AnalyticsSeriesPoint } from "../lib/analytics";

export const analyticsPalette = {
  blue: "#2754f5",
  teal: "#10a6a0",
  green: "#0f8a61",
  amber: "#d97706",
  red: "#b42318",
  purple: "#6941c6",
  cyan: "#0891b2",
  gray: "#667085",
  slate: "#182230"
};

const chartColors = [
  analyticsPalette.blue,
  analyticsPalette.teal,
  analyticsPalette.green,
  analyticsPalette.amber,
  analyticsPalette.purple,
  analyticsPalette.cyan,
  analyticsPalette.red,
  analyticsPalette.gray
];

export function formatAnalyticsNumber(value?: number | null, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) return "Sin dato";
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(value);
}

export function formatAnalyticsMoney(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

export function formatAnalyticsPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) return "Sin comparación";
  return `${value > 0 ? "+" : ""}${formatAnalyticsNumber(value, 1)}%`;
}

export function seriesTotal(series?: AnalyticsSeriesPoint[], key: keyof AnalyticsSeriesPoint = "value") {
  return (series ?? []).reduce((total, item) => total + Number(item[key] ?? 0), 0);
}

export function distributionTotal(items?: AnalyticsDistributionItem[]) {
  return (items ?? []).reduce((total, item) => total + Number(item.value ?? 0), 0);
}

export function hasSeriesData(series?: AnalyticsSeriesPoint[], key: keyof AnalyticsSeriesPoint = "value") {
  return seriesTotal(series, key) > 0;
}

export function hasDistributionData(items?: AnalyticsDistributionItem[]) {
  return distributionTotal(items) > 0;
}

export function AnalyticsSection({ id, title, description, children, actions }: { id: string; title: string; description: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="analyticsSection" id={id} aria-labelledby={`${id}-title`}>
      <header>
        <div>
          <span>Analítica</span>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
        {actions ? <div className="analyticsSectionActions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function AnalyticsKpiCard({ icon: Icon, label, value, kpi, definition, tone = "blue" }: { icon: LucideIcon; label: string; value: string; kpi?: AnalyticsKpi; definition: string; tone?: keyof typeof analyticsPalette }) {
  const change = kpi?.change_percentage;
  const trend = change === null || change === undefined ? "neutral" : change > 0 ? "up" : change < 0 ? "down" : "neutral";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Info;
  return (
    <article className="analyticsKpiCard">
      <span className="analyticsKpiIcon" style={{ color: analyticsPalette[tone], backgroundColor: `${analyticsPalette[tone]}18` }}><Icon size={20} /></span>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{definition}</small>
      <em className={`analyticsTrend ${trend}`}><TrendIcon size={14} /> {formatAnalyticsPercent(change)}</em>
    </article>
  );
}

export function AnalyticsChartCard({ title, description, children, summary, error, onRetry }: { title: string; description: string; children: ReactNode; summary: string; error?: string; onRetry?: () => void }) {
  return (
    <article className="analyticsChartCard" aria-label={title}>
      <header>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <BarChart3 size={20} aria-hidden="true" />
      </header>
      {error ? (
        <div className="analyticsChartError" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>No pudimos cargar esta métrica.</strong>
            <p>{error}</p>
            {onRetry ? <button type="button" onClick={onRetry}>Reintentar</button> : null}
          </div>
        </div>
      ) : children}
      <p className="analyticsChartSummary">{summary}</p>
    </article>
  );
}

export function AnalyticsEmptyChart() {
  return (
    <div className="analyticsEmptyChart">
      <BarChart3 size={24} />
      <strong>No hay datos para este periodo.</strong>
      <span>Prueba con otro rango de fechas o elimina algunos filtros.</span>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return <div className="analyticsSkeleton" aria-label="Cargando analítica">{Array.from({ length: 4 }).map((_, index) => <span key={index} />)}</div>;
}

export function LineChart({ data, valueKey = "value", color = analyticsPalette.blue, label }: { data: AnalyticsSeriesPoint[]; valueKey?: keyof AnalyticsSeriesPoint; color?: string; label: string }) {
  if (!hasSeriesData(data, valueKey)) return <AnalyticsEmptyChart />;
  const width = 680;
  const height = 250;
  const padding = 34;
  const values = data.map((item) => Number(item[valueKey] ?? 0));
  const max = Math.max(...values, 1);
  const step = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
  const points = data.map((item, index) => {
    const x = padding + index * step;
    const y = height - padding - (Number(item[valueKey] ?? 0) / max) * (height - padding * 2);
    return { x, y, item };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const area = `${path} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="analyticsSvgWrap" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${width} ${height}`} className="analyticsSvg">
        <path d={area} fill={`${color}18`} />
        <path d={path} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.item.period}>
            <circle cx={point.x} cy={point.y} r="5" fill="white" stroke={color} strokeWidth="3" />
            <title>{`${point.item.label}: ${formatAnalyticsNumber(Number(point.item[valueKey] ?? 0), 2)}`}</title>
          </g>
        ))}
        {[0, Math.ceil(max / 2), max].map((tick, index) => {
          const y = height - padding - (tick / max) * (height - padding * 2);
          return <text key={index} x="4" y={y + 4} className="analyticsAxisLabel">{formatAnalyticsNumber(tick)}</text>;
        })}
        {points.filter((_, index) => index === 0 || index === points.length - 1).map((point) => (
          <text key={`label-${point.item.period}`} x={point.x} y={height - 8} textAnchor={point.x > width / 2 ? "end" : "start"} className="analyticsAxisLabel">{point.item.label}</text>
        ))}
      </svg>
    </div>
  );
}

export function BarChart({ data, horizontal = false, color = analyticsPalette.blue, label }: { data: AnalyticsDistributionItem[]; horizontal?: boolean; color?: string; label: string }) {
  if (!hasDistributionData(data)) return <AnalyticsEmptyChart />;
  const items = data.slice(0, 8);
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className={`analyticsBars ${horizontal ? "horizontal" : ""}`} role="img" aria-label={label}>
      {items.map((item, index) => (
        <div className="analyticsBarRow" key={`${item.label}-${index}`}>
          <span>{item.label}</span>
          <div><i style={{ width: `${Math.max((item.value / max) * 100, 3)}%`, background: chartColors[index % chartColors.length] || color }} /></div>
          <strong>{formatAnalyticsNumber(item.value, Number.isInteger(item.value) ? 0 : 1)}</strong>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ data, label }: { data: AnalyticsDistributionItem[]; label: string }) {
  if (!hasDistributionData(data)) return <AnalyticsEmptyChart />;
  const total = distributionTotal(data);
  let offset = 25;
  return (
    <div className="analyticsDonutWrap">
      <svg viewBox="0 0 42 42" className="analyticsDonut" role="img" aria-label={label}>
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#eef2f7" strokeWidth="6" />
        {data.slice(0, 7).map((item, index) => {
          const portion = total ? (item.value / total) * 100 : 0;
          const circle = <circle key={item.label} cx="21" cy="21" r="15.915" fill="transparent" stroke={chartColors[index % chartColors.length]} strokeWidth="6" strokeDasharray={`${portion} ${100 - portion}`} strokeDashoffset={offset} />;
          offset -= portion;
          return circle;
        })}
      </svg>
      <div className="analyticsLegend">
        {data.slice(0, 7).map((item, index) => (
          <span key={item.label}><i style={{ background: chartColors[index % chartColors.length] }} /> {item.label} · {formatAnalyticsNumber(item.value)}</span>
        ))}
      </div>
    </div>
  );
}

export function DoubleBarChart({ data, leftKey, rightKey, leftLabel, rightLabel }: { data: Array<Record<string, number | string | null>>; leftKey: string; rightKey: string; leftLabel: string; rightLabel: string }) {
  const rows = data.slice(0, 8);
  const max = Math.max(...rows.flatMap((row) => [Number(row[leftKey] ?? 0), Number(row[rightKey] ?? 0)]), 1);
  if (!rows.some((row) => Number(row[leftKey] ?? 0) > 0 || Number(row[rightKey] ?? 0) > 0)) return <AnalyticsEmptyChart />;
  return (
    <div className="analyticsDoubleBars" role="img" aria-label={`${leftLabel} contra ${rightLabel}`}>
      <div className="analyticsLegend inline"><span><i style={{ background: analyticsPalette.blue }} /> {leftLabel}</span><span><i style={{ background: analyticsPalette.teal }} /> {rightLabel}</span></div>
      {rows.map((row) => (
        <div className="analyticsDoubleRow" key={String(row.category ?? row.label)}>
          <strong>{String(row.category ?? row.label ?? "Sin dato")}</strong>
          <div><i style={{ width: `${(Number(row[leftKey] ?? 0) / max) * 100}%`, background: analyticsPalette.blue }} /><i style={{ width: `${(Number(row[rightKey] ?? 0) / max) * 100}%`, background: analyticsPalette.teal }} /></div>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsDataTable({ columns, rows, empty = "No hay datos para mostrar." }: { columns: string[]; rows: Array<Array<string | number | null | undefined>>; empty?: string }) {
  return (
    <div className="analyticsTableWrap">
      <table className="analyticsTable">
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell ?? "Sin dato"}</td>)}</tr>
          )) : <tr><td colSpan={columns.length}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
