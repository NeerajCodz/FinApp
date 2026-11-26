'use client';

/**
 * FinApp charts for the web: SVG marks, HTML tooltips, a legend for 2+ series and a
 * visually-hidden data table on every plot (the table view). Colours come from theme tokens and
 * the validated series palette, so charts follow light/dark and accents.
 */
import * as React from 'react';
import { useTheme } from '../../web/ThemeProvider';
import {
  areaPath,
  arcPath,
  bands,
  barPath,
  donutSegments,
  labelStride,
  linear,
  linePath,
  nearestIndex,
  neutralColor,
  sequentialColor,
  seriesColor,
  valueDomain,
} from '../core';
import styles from './Charts.module.css';

// ---------- Shared pieces ----------

export type ChartSeries = {
  id: string;
  label: string;
  values: readonly number[];
  /** Defaults to the series palette in order. */
  color?: string;
};

type Format = (value: number, index?: number) => string;
const plain: Format = (value) => new Intl.NumberFormat().format(Math.round(value));

function useWidth<T extends HTMLElement>(fallback = 320) {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(fallback);
  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setWidth(Math.max(120, Math.floor(node.getBoundingClientRect().width)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function useColors() {
  const { tokens, isDark } = useTheme();
  return {
    dark: isDark,
    surface: tokens.background,
    grid: tokens.borderSubtle,
    axis: tokens.foregroundSubtle,
    text: tokens.foreground,
    muted: tokens.foregroundMuted,
    income: tokens.income,
    expense: tokens.expense,
    primary: tokens.primary,
  };
}

export function ChartLegend({
  items,
}: {
  items: readonly { label: string; color: string; value?: string; line?: boolean }[];
}) {
  return (
    <ul className={styles.legend}>
      {items.map((item) => (
        <li key={item.label}>
          <span
            className={item.line ? styles.keyLine : styles.keyDot}
            style={{ background: item.color }}
            aria-hidden
          />
          <span>{item.label}</span>
          {item.value ? <strong>{item.value}</strong> : null}
        </li>
      ))}
    </ul>
  );
}

function DataTable({
  caption,
  labels,
  series,
  format,
}: {
  caption: string;
  labels: readonly string[];
  series: readonly { label: string; values: readonly number[] }[];
  format: Format;
}) {
  return (
    <table className={styles.srOnly}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Period</th>
          {series.map((s) => (
            <th key={s.label} scope="col">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((label, index) => (
          <tr key={`${label}-${index}`}>
            <th scope="row">{label}</th>
            {series.map((s) => (
              <td key={s.label}>{format(s.values[index] ?? 0, index)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tooltip({
  x,
  width,
  title,
  rows,
}: {
  x: number;
  width: number;
  title: string;
  rows: readonly { label: string; value: string; color: string }[];
}) {
  const left = Math.min(Math.max(x, 80), Math.max(80, width - 80));
  return (
    <div className={styles.tooltip} style={{ left }} role="status">
      <strong>{title}</strong>
      {rows.map((row) => (
        <span key={row.label} className={styles.tooltipRow}>
          <span className={styles.keyDot} style={{ background: row.color }} aria-hidden />
          <span>{row.label}</span>
          <b>{row.value}</b>
        </span>
      ))}
    </div>
  );
}

const PAD = { top: 12, right: 12, bottom: 26, left: 52 };

function useHover(count: number, plotWidth: number) {
  const [index, setIndex] = React.useState<number | null>(null);
  const onMove = (event: React.PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setIndex(nearestIndex(event.clientX - rect.left, count, plotWidth));
  };
  const onKey = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'ArrowRight') setIndex((i) => Math.min(count - 1, (i ?? -1) + 1));
    else if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, (i ?? count) - 1));
    else if (event.key === 'Escape') setIndex(null);
    else return;
    event.preventDefault();
  };
  return { index, setIndex, onMove, onKey };
}

function Axes({
  ticks,
  y,
  width,
  labels,
  x,
  axisFormat,
  colors,
  height,
}: {
  ticks: readonly number[];
  y: (value: number) => number;
  width: number;
  labels: readonly string[];
  x: (index: number) => number;
  axisFormat: Format;
  colors: ReturnType<typeof useColors>;
  height: number;
}) {
  const stride = labelStride(labels.length, Math.max(2, Math.floor(width / 56)));
  return (
    <g aria-hidden>
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={0}
            x2={width}
            y1={y(tick)}
            y2={y(tick)}
            stroke={tick === 0 ? colors.axis : colors.grid}
            strokeWidth={1}
            shapeRendering="crispEdges"
          />
          <text
            x={-8}
            y={y(tick)}
            dy="0.32em"
            textAnchor="end"
            className={styles.axisText}
            fill={colors.muted}
          >
            {axisFormat(tick)}
          </text>
        </g>
      ))}
      {labels.map((label, index) =>
        index % stride === 0 ? (
          <text
            key={`${label}-${index}`}
            x={x(index)}
            y={height + 18}
            textAnchor="middle"
            className={styles.axisText}
            fill={colors.muted}
          >
            {label}
          </text>
        ) : null,
      )}
    </g>
  );
}

// ---------- Line / area ----------

export function LineChart({
  series,
  labels,
  height = 220,
  area = true,
  smooth = true,
  format = plain,
  axisFormat = format,
  titles,
  caption = 'Line chart',
  onSelect,
  showLegend,
}: {
  series: readonly ChartSeries[];
  labels: readonly string[];
  height?: number;
  area?: boolean;
  smooth?: boolean;
  format?: Format;
  axisFormat?: Format;
  /** Tooltip heading per point (defaults to the axis label). */
  titles?: readonly string[];
  caption?: string;
  onSelect?: (index: number) => void;
  showLegend?: boolean;
}) {
  const colors = useColors();
  const [ref, width] = useWidth<HTMLDivElement>();
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const count = labels.length;
  const { domain, ticks } = valueDomain(series.flatMap((s) => s.values));
  const y = linear(domain, [plotH, 0]);
  const x = (index: number) => (count <= 1 ? plotW / 2 : (index / (count - 1)) * plotW);
  const hover = useHover(count, plotW);
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? seriesColor(i, colors.dark) }));
  const gradientId = React.useId();

  return (
    <div className={styles.chart} ref={ref}>
      {(showLegend ?? colored.length > 1) ? (
        <ChartLegend items={colored.map((s) => ({ label: s.label, color: s.color, line: true }))} />
      ) : null}
      <div className={styles.plot}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={caption}
          tabIndex={0}
          onKeyDown={hover.onKey}
          onBlur={() => hover.setIndex(null)}
          className={styles.svg}
        >
          <defs>
            {colored.map((s, i) => (
              <linearGradient key={s.id} id={`${gradientId}-${i}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            <Axes
              ticks={ticks}
              y={y}
              width={plotW}
              labels={labels}
              x={x}
              axisFormat={axisFormat}
              colors={colors}
              height={plotH}
            />
            {colored.map((s, i) => {
              const points = s.values.map((value, index) => ({ x: x(index), y: y(value) }));
              return (
                <g key={s.id}>
                  {area && colored.length <= 2 ? (
                    <path
                      d={areaPath(points, y(Math.max(domain[0], 0)), smooth)}
                      fill={`url(#${gradientId}-${i})`}
                    />
                  ) : null}
                  <path
                    d={linePath(points, smooth)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {count <= 1 ? (
                    <circle
                      cx={points[0]?.x}
                      cy={points[0]?.y}
                      r={4}
                      fill={s.color}
                      stroke={colors.surface}
                      strokeWidth={2}
                    />
                  ) : null}
                </g>
              );
            })}
            {hover.index !== null ? (
              <g aria-hidden>
                <line
                  x1={x(hover.index)}
                  x2={x(hover.index)}
                  y1={0}
                  y2={plotH}
                  stroke={colors.axis}
                  strokeWidth={1}
                />
                {colored.map((s) => (
                  <circle
                    key={s.id}
                    cx={x(hover.index!)}
                    cy={y(s.values[hover.index!] ?? 0)}
                    r={4.5}
                    fill={s.color}
                    stroke={colors.surface}
                    strokeWidth={2}
                  />
                ))}
              </g>
            ) : null}
            <rect
              width={plotW}
              height={plotH}
              fill="transparent"
              onPointerMove={hover.onMove}
              onPointerLeave={() => hover.setIndex(null)}
              onClick={() => hover.index !== null && onSelect?.(hover.index)}
              style={{ cursor: onSelect ? 'pointer' : 'crosshair' }}
            />
          </g>
        </svg>
        {hover.index !== null ? (
          <Tooltip
            x={PAD.left + x(hover.index)}
            width={width}
            title={titles?.[hover.index] ?? labels[hover.index] ?? ''}
            rows={colored.map((s) => ({
              label: s.label,
              value: format(s.values[hover.index!] ?? 0, hover.index!),
              color: s.color,
            }))}
          />
        ) : null}
      </div>
      <DataTable caption={caption} labels={labels} series={colored} format={format} />
    </div>
  );
}

// ---------- Columns (grouped / stacked / diverging, optional line) ----------

export function ColumnChart({
  series,
  labels,
  mode = 'grouped',
  line,
  height = 240,
  format = plain,
  axisFormat = format,
  titles,
  highlightIndex,
  caption = 'Column chart',
  onSelect,
  showLegend,
}: {
  series: readonly ChartSeries[];
  labels: readonly string[];
  /** grouped: side by side · stacked: one column · diverging: negatives below zero. */
  mode?: 'grouped' | 'stacked' | 'diverging';
  /** A line on the same axis (e.g. net cash flow). */
  line?: ChartSeries;
  height?: number;
  format?: Format;
  axisFormat?: Format;
  titles?: readonly string[];
  highlightIndex?: number;
  caption?: string;
  onSelect?: (index: number) => void;
  showLegend?: boolean;
}) {
  const colors = useColors();
  const [ref, width] = useWidth<HTMLDivElement>();
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const count = labels.length;
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? seriesColor(i, colors.dark) }));
  const lineColor = line?.color ?? colors.text;
  const stackTotals = labels.map((_, index) => {
    let up = 0;
    let down = 0;
    for (const s of colored) {
      const value = s.values[index] ?? 0;
      if (value >= 0) up += value;
      else down += value;
    }
    return { up, down };
  });
  const domainValues =
    mode === 'stacked'
      ? stackTotals.flatMap((t) => [t.up, t.down])
      : [...colored.flatMap((s) => s.values), ...(line?.values ?? [])];
  const { domain, ticks } = valueDomain(domainValues);
  const y = linear(domain, [plotH, 0]);
  const zero = y(0);
  const band = bands(
    count,
    plotW,
    mode === 'grouped' ? 24 * Math.max(1, colored.length) : 24,
    mode === 'grouped' ? 0.72 : 0.6,
  );
  const hover = useHover(count, plotW);
  const groupBar =
    mode === 'grouped'
      ? Math.max(2, (band.bar - 2 * (colored.length - 1)) / colored.length)
      : band.bar;

  return (
    <div className={styles.chart} ref={ref}>
      {(showLegend ?? colored.length + (line ? 1 : 0) > 1) ? (
        <ChartLegend
          items={[
            ...colored.map((s) => ({ label: s.label, color: s.color })),
            ...(line ? [{ label: line.label, color: lineColor, line: true }] : []),
          ]}
        />
      ) : null}
      <div className={styles.plot}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={caption}
          tabIndex={0}
          onKeyDown={hover.onKey}
          onBlur={() => hover.setIndex(null)}
          className={styles.svg}
        >
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            <Axes
              ticks={ticks}
              y={y}
              width={plotW}
              labels={labels}
              x={band.center}
              axisFormat={axisFormat}
              colors={colors}
              height={plotH}
            />
            {labels.map((_, index) => {
              const dim =
                (highlightIndex !== undefined && highlightIndex !== index) ||
                (hover.index !== null && hover.index !== index);
              let up = 0;
              let down = 0;
              return (
                <g key={index} opacity={dim ? 0.45 : 1}>
                  {colored.map((s, si) => {
                    const value = s.values[index] ?? 0;
                    if (mode === 'grouped' || mode === 'diverging') {
                      const left =
                        mode === 'grouped'
                          ? band.start(index) + si * (groupBar + 2)
                          : band.start(index);
                      return (
                        <path
                          key={s.id}
                          d={barPath(left, groupBar, zero, y(value))}
                          fill={s.color}
                        />
                      );
                    }
                    // Stacked: 2px surface gap between segments; only the outer end is rounded.
                    const from = value >= 0 ? up : down;
                    const to = from + value;
                    if (value >= 0) up = to;
                    else down = to;
                    const outer =
                      value >= 0 ? to === stackTotals[index]!.up : to === stackTotals[index]!.down;
                    const y0 = y(from);
                    const y1 = y(to);
                    const gap = from === 0 ? 0 : 1;
                    return (
                      <path
                        key={s.id}
                        d={barPath(
                          band.start(index),
                          band.bar,
                          value >= 0 ? y0 - gap : y0 + gap,
                          y1,
                          outer ? 4 : 0,
                        )}
                        fill={s.color}
                      />
                    );
                  })}
                </g>
              );
            })}
            {line ? (
              <g>
                <path
                  d={linePath(
                    line.values.map((value, index) => ({ x: band.center(index), y: y(value) })),
                    false,
                  )}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                {line.values.map((value, index) => (
                  <circle
                    key={index}
                    cx={band.center(index)}
                    cy={y(value)}
                    r={count > 40 ? 0 : 3.5}
                    fill={lineColor}
                    stroke={colors.surface}
                    strokeWidth={2}
                  />
                ))}
              </g>
            ) : null}
            <rect
              width={plotW}
              height={plotH}
              fill="transparent"
              onPointerMove={hover.onMove}
              onPointerLeave={() => hover.setIndex(null)}
              onClick={() => hover.index !== null && onSelect?.(hover.index)}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
            />
          </g>
        </svg>
        {hover.index !== null ? (
          <Tooltip
            x={PAD.left + band.center(hover.index)}
            width={width}
            title={titles?.[hover.index] ?? labels[hover.index] ?? ''}
            rows={[
              ...colored.map((s) => ({
                label: s.label,
                value: format(Math.abs(s.values[hover.index!] ?? 0), hover.index!),
                color: s.color,
              })),
              ...(line
                ? [
                    {
                      label: line.label,
                      value: format(line.values[hover.index!] ?? 0, hover.index!),
                      color: lineColor,
                    },
                  ]
                : []),
            ]}
          />
        ) : null}
      </div>
      <DataTable
        caption={caption}
        labels={labels}
        series={[...colored, ...(line ? [line] : [])]}
        format={format}
      />
    </div>
  );
}

// ---------- Ranked horizontal bars ----------

export type RankedItem = {
  id: string;
  label: string;
  value: number;
  /** Shown at the end of the row (e.g. "₹6,000"). */
  display: string;
  color?: string;
  icon?: React.ReactNode;
  detail?: string;
};

export function RankedBars({
  items,
  max,
  onSelect,
  caption = 'Ranked list',
}: {
  items: readonly RankedItem[];
  /** Full-width value (defaults to the largest item). */
  max?: number;
  onSelect?: (item: RankedItem) => void;
  caption?: string;
}) {
  const colors = useColors();
  const top = max ?? Math.max(0, ...items.map((item) => item.value));
  return (
    <ul className={styles.ranked} aria-label={caption}>
      {items.map((item, index) => {
        const share = top > 0 ? Math.max(0, item.value) / top : 0;
        const color = item.color ?? seriesColor(index, colors.dark);
        const Row = onSelect ? 'button' : 'div';
        return (
          <li key={item.id}>
            <Row
              type={onSelect ? 'button' : undefined}
              className={styles.rankedRow}
              onClick={onSelect ? () => onSelect(item) : undefined}
              aria-label={`${item.label}: ${item.display}`}
            >
              {item.icon ? <span className={styles.rankedIcon}>{item.icon}</span> : null}
              <span className={styles.rankedLabel}>
                <span>{item.label}</span>
                {item.detail ? <small>{item.detail}</small> : null}
              </span>
              <span className={styles.rankedTrack} aria-hidden>
                <span
                  className={styles.rankedFill}
                  style={{ width: `${share * 100}%`, background: color }}
                />
              </span>
              <span className={styles.rankedValue}>{item.display}</span>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Donut ----------

export type DonutItem = {
  id: string;
  label: string;
  value: number;
  display: string;
  color?: string;
  icon?: React.ReactNode;
};

export function DonutChart({
  items,
  centerValue,
  centerLabel,
  size = 200,
  legend = true,
  onSelect,
  caption = 'Breakdown',
}: {
  items: readonly DonutItem[];
  centerValue?: string;
  centerLabel?: string;
  size?: number;
  legend?: boolean;
  onSelect?: (item: DonutItem) => void;
  caption?: string;
}) {
  const colors = useColors();
  const [active, setActive] = React.useState<number | null>(null);
  const colored = items.map((item, i) => ({
    ...item,
    color: item.color ?? seriesColor(i, colors.dark),
  }));
  const segments = donutSegments(colored.map((item) => item.value));
  const total = colored.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const c = size / 2;
  const outer = c - 2;
  const inner = outer - Math.max(14, size * 0.12);
  const focus = active !== null ? colored[active] : null;
  return (
    <div className={styles.donut}>
      <div className={styles.donutRing} style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={caption}>
          {total <= 0 ? (
            <circle
              cx={c}
              cy={c}
              r={(outer + inner) / 2}
              fill="none"
              stroke={colors.grid}
              strokeWidth={outer - inner}
            />
          ) : null}
          {colored.map((item, index) => {
            const segment = segments[index];
            if (!segment) return null;
            const grow = active === index ? 3 : 0;
            return (
              <path
                key={item.id}
                d={arcPath(
                  c,
                  c,
                  outer + grow - (active === index ? 0 : 0),
                  inner,
                  segment.start,
                  segment.end,
                )}
                fill={item.color}
                opacity={active !== null && active !== index ? 0.4 : 1}
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
                onClick={onSelect ? () => onSelect(item) : undefined}
                style={{ cursor: onSelect ? 'pointer' : 'default', transition: 'opacity 120ms' }}
              />
            );
          })}
        </svg>
        <div className={styles.donutCenter} aria-hidden>
          <strong>{focus ? focus.display : centerValue}</strong>
          <span>
            {focus
              ? `${focus.label} · ${Math.round((Math.max(0, focus.value) / (total || 1)) * 100)}%`
              : centerLabel}
          </span>
        </div>
      </div>
      {legend ? (
        <ul className={styles.donutLegend}>
          {colored.map((item, index) => {
            const Row = onSelect ? 'button' : 'div';
            return (
              <li key={item.id}>
                <Row
                  type={onSelect ? 'button' : undefined}
                  className={styles.donutLegendRow}
                  data-active={active === index || undefined}
                  onPointerEnter={() => setActive(index)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  onClick={onSelect ? () => onSelect(item) : undefined}
                >
                  <span className={styles.keyDot} style={{ background: item.color }} aria-hidden />
                  {item.icon ? <span className={styles.donutIcon}>{item.icon}</span> : null}
                  <span className={styles.donutName}>{item.label}</span>
                  <span className={styles.donutShare}>
                    {Math.round((Math.max(0, item.value) / (total || 1)) * 100)}%
                  </span>
                  <span className={styles.donutValue}>{item.display}</span>
                </Row>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

// ---------- Sparklines ----------

export function Sparkline({
  values,
  color,
  width = 120,
  height = 36,
  area = true,
  label,
}: {
  values: readonly number[];
  color?: string;
  width?: number;
  height?: number;
  area?: boolean;
  label?: string;
}) {
  const colors = useColors();
  const stroke = color ?? colors.primary;
  const id = React.useId();
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const y = linear([min, max === min ? min + 1 : max], [height - 4, 4]);
  const x = (index: number) =>
    values.length <= 1 ? width / 2 : (index / (values.length - 1)) * (width - 6) + 3;
  const points = values.map((value, index) => ({ x: x(index), y: y(value) }));
  const last = points[points.length - 1]!;
  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={label ?? 'Trend'}
      className={styles.inline}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      {area ? <path d={areaPath(points, height)} fill={`url(#${id})`} /> : null}
      <path
        d={linePath(points)}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r={3}
        fill={stroke}
        stroke={colors.surface}
        strokeWidth={1.5}
      />
    </svg>
  );
}

export function SparkBars({
  values,
  color,
  width = 84,
  height = 40,
  label,
}: {
  values: readonly number[];
  color?: string;
  width?: number;
  height?: number;
  label?: string;
}) {
  const colors = useColors();
  const fill = color ?? colors.primary;
  if (!values.length) return null;
  const max = Math.max(...values.map(Math.abs), 1);
  const band = bands(values.length, width, 7, 0.62);
  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={label ?? 'Trend'}
      className={styles.inline}
    >
      {values.map((value, index) => {
        const h = Math.max(2, (Math.abs(value) / max) * (height - 2));
        return (
          <path
            key={index}
            d={barPath(band.start(index), band.bar, height, height - h, 2)}
            fill={fill}
            opacity={
              index === values.length - 1
                ? 1
                : 0.35 + (0.45 * index) / Math.max(1, values.length - 1)
            }
          />
        );
      })}
    </svg>
  );
}

// ---------- Meters ----------

/** Limit usage: fill colour carries severity (under 80% · 80–100% · over). */
export function Meter({
  value,
  max,
  label,
  detail,
  thin,
}: {
  value: number;
  max: number;
  label?: string;
  detail?: string;
  thin?: boolean;
}) {
  const { tokens } = useTheme();
  const ratio = max > 0 ? value / max : 0;
  const color = ratio > 1 ? tokens.expense : ratio >= 0.8 ? tokens.warning : tokens.income;
  return (
    <div className={styles.meter}>
      {label || detail ? (
        <div className={styles.meterText}>
          {label ? <span>{label}</span> : <span />}
          {detail ? <small>{detail}</small> : null}
        </div>
      ) : null}
      <div
        className={styles.meterTrack}
        style={{
          height: thin ? 4 : 8,
          background: `color-mix(in srgb, ${color} 18%, transparent)`,
        }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label ?? 'Usage'}
      >
        <span style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

export function RingProgress({
  value,
  size = 64,
  stroke = 7,
  color,
  children,
  label,
}: {
  /** 0–1 (values over 1 show a full ring). */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  const colors = useColors();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  const tone = color ?? colors.primary;
  return (
    <div className={styles.ring} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={label ?? `${Math.round(clamped * 100)}%`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`color-mix(in srgb, ${tone} 18%, transparent)`}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children ? <div className={styles.ringCenter}>{children}</div> : null}
    </div>
  );
}

/** One whole split into parts (thin: 8px, no text; tall: 28px with shares inside). */
export function SegmentedBar({
  parts,
  tall,
  caption = 'Split',
}: {
  parts: readonly { label: string; value: number; color?: string }[];
  tall?: boolean;
  caption?: string;
}) {
  const colors = useColors();
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);
  return (
    <div
      className={styles.segmented}
      style={{ height: tall ? 28 : 8 }}
      role="img"
      aria-label={`${caption}: ${parts.map((p) => `${p.label} ${Math.round((Math.max(0, p.value) / (total || 1)) * 100)}%`).join(', ')}`}
    >
      {parts.map((part, index) =>
        part.value > 0 ? (
          <span
            key={part.label}
            style={{
              flexGrow: part.value,
              background: part.color ?? seriesColor(index, colors.dark),
              borderRadius: tall ? 4 : 999,
            }}
            title={`${part.label}: ${Math.round((part.value / (total || 1)) * 100)}%`}
          >
            {tall && part.value / (total || 1) >= 0.12
              ? `${Math.round((part.value / (total || 1)) * 100)}%`
              : null}
          </span>
        ) : null,
      )}
    </div>
  );
}

// ---------- Heatmap / matrix ----------

export function Heatmap({
  rows,
  columns,
  format = plain,
  cell = 18,
  caption = 'Heatmap',
  onSelect,
}: {
  rows: readonly { label: string; values: readonly number[] }[];
  columns: readonly string[];
  format?: Format;
  cell?: number;
  caption?: string;
  onSelect?: (row: number, column: number) => void;
}) {
  const colors = useColors();
  const [hover, setHover] = React.useState<{ r: number; c: number } | null>(null);
  const max = Math.max(0, ...rows.flatMap((row) => row.values));
  const labelW = Math.max(28, ...rows.map((row) => row.label.length * 7));
  const gap = 3;
  const width = labelW + columns.length * (cell + gap);
  const height = 18 + rows.length * (cell + gap);
  const stride = labelStride(columns.length, Math.floor((columns.length * (cell + gap)) / 44));
  return (
    <div className={styles.heatmap}>
      <svg width={width} height={height} role="img" aria-label={caption}>
        {columns.map((column, c) =>
          c % stride === 0 ? (
            <text
              key={column + c}
              x={labelW + c * (cell + gap) + cell / 2}
              y={11}
              textAnchor="middle"
              className={styles.axisText}
              fill={colors.muted}
            >
              {column}
            </text>
          ) : null,
        )}
        {rows.map((row, r) => (
          <g key={row.label + r}>
            <text
              x={labelW - 6}
              y={18 + r * (cell + gap) + cell / 2}
              dy="0.32em"
              textAnchor="end"
              className={styles.axisText}
              fill={colors.muted}
            >
              {row.label}
            </text>
            {row.values.map((value, c) => (
              <rect
                key={c}
                x={labelW + c * (cell + gap)}
                y={18 + r * (cell + gap)}
                width={cell}
                height={cell}
                rx={4}
                fill={
                  value > 0 ? sequentialColor(max > 0 ? value / max : 0, colors.dark) : colors.grid
                }
                stroke={hover?.r === r && hover.c === c ? colors.text : 'none'}
                onPointerEnter={() => setHover({ r, c })}
                onPointerLeave={() => setHover(null)}
                onClick={onSelect ? () => onSelect(r, c) : undefined}
              >
                <title>{`${row.label}, ${columns[c]}: ${format(value)}`}</title>
              </rect>
            ))}
          </g>
        ))}
      </svg>
      <div className={styles.heatScale} aria-hidden>
        <span>Less</span>
        {[0.1, 0.35, 0.6, 0.85, 1].map((t) => (
          <i key={t} style={{ background: sequentialColor(t, colors.dark) }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export { neutralColor, seriesColor };
