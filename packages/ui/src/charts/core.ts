/**
 * Chart math shared by the web (SVG) and native (react-native-svg) renderers: scales, nice
 * ticks, compact money labels and path builders. No React, no platform APIs.
 *
 * Mark specs (see the dataviz guide): bars ≤ 24px thick with a 4px rounded data-end and a
 * square baseline, 2px lines, ≥ 8px markers with a 2px surface ring, 10% area washes, hairline
 * solid gridlines, a 2px surface gap between touching marks.
 */

// ---------- Palette ----------

/**
 * Categorical series colours, validated (CVD and normal-vision separation, lightness band) for
 * FinApp's light (#ffffff) and dark (#0b0b0b) surfaces. Assign in this order; never cycle — a
 * ninth series folds into "Other".
 */
export const SERIES_LIGHT = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
] as const;
export const SERIES_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#0ca30c',
  '#9085e9',
  '#e66767',
] as const;
export const MAX_SERIES = SERIES_LIGHT.length;

export function seriesColor(index: number, dark: boolean): string {
  const palette = dark ? SERIES_DARK : SERIES_LIGHT;
  return palette[Math.min(index, palette.length - 1)]!;
}

/** A neutral for "Other" and de-emphasised marks. */
export function neutralColor(dark: boolean): string {
  return dark ? '#5c5c5c' : '#b4b4b4';
}

/** Sequential ramp (one hue, light → dark on light surfaces; reversed on dark) for heatmaps. */
export function sequentialColor(t: number, dark: boolean, hue = '#3987e5'): string {
  const clamped = Math.max(0, Math.min(1, t));
  const [r, g, b] = hexToRgb(hue);
  const [sr, sg, sb] = dark ? [24, 24, 24] : [238, 241, 246];
  const mix = 0.12 + clamped * 0.88;
  const channel = (from: number, to: number) => Math.round(from + (to - from) * mix);
  return rgbToHex(channel(sr, r), channel(sg, g), channel(sb, b));
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// ---------- Scales & ticks ----------

export type Domain = readonly [number, number];

/** Clean tick values covering [min, max] (always including 0 when the range spans it). */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    if (min === 0) return [0, 1];
    const pad = Math.abs(min) * 0.5;
    return niceTicks(Math.min(0, min - pad), Math.max(0, max + pad), count);
  }
  const span = max - min;
  const raw = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw) ??
    10 * magnitude;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step)
    ticks.push(Number(value.toFixed(10)));
  return ticks;
}

/** The domain to draw for some values: includes 0, padded to nice ticks. */
export function valueDomain(
  values: readonly number[],
  count = 4,
): { domain: Domain; ticks: number[] } {
  const finite = values.filter(Number.isFinite);
  const min = Math.min(0, ...finite);
  const max = Math.max(0, ...finite);
  const ticks = niceTicks(min, max === min ? min + 1 : max, count);
  return { domain: [ticks[0]!, ticks[ticks.length - 1]!], ticks };
}

export function linear(domain: Domain, range: Domain) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** Even bands for `count` categories across `width`; bar width capped at `maxBar`. */
export function bands(count: number, width: number, maxBar = 24, fill = 0.6) {
  const step = count > 0 ? width / count : width;
  const bar = Math.max(2, Math.min(maxBar, step * fill));
  return {
    step,
    bar,
    center: (index: number) => step * index + step / 2,
    start: (index: number) => step * index + (step - bar) / 2,
  };
}

// ---------- Labels ----------

/** "₹12.5K", "$3.2M", "₹900" — compact money for axes. */
export function compactMoney(value: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: Math.abs(value) >= 10_000 ? 'compact' : 'standard',
      maximumFractionDigits: Math.abs(value) >= 10_000 ? 1 : 0,
    }).format(value);
  } catch {
    return String(Math.round(value));
  }
}

/** Full money for tooltips and legends. */
export function fullMoney(value: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

export function compactNumber(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    notation: Math.abs(value) >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

/** Every n-th label so they don't collide (`maxLabels` across the axis). */
export function labelStride(count: number, maxLabels: number): number {
  return Math.max(1, Math.ceil(count / Math.max(1, maxLabels)));
}

// ---------- Paths ----------

export type Point = { x: number; y: number };

/** Straight or monotone-smoothed polyline (`M…L…` / cubic Béziers that never overshoot). */
export function linePath(points: readonly Point[], smooth = true): string {
  if (!points.length) return '';
  if (points.length === 1 || !smooth)
    return points.map((p, i) => `${i ? 'L' : 'M'}${round(p.x)} ${round(p.y)}`).join('');
  const tangents = monotoneTangents(points);
  let d = `M${round(points[0]!.x)} ${round(points[0]!.y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const dx = (p1.x - p0.x) / 3;
    d += `C${round(p0.x + dx)} ${round(p0.y + tangents[i]! * dx)} ${round(p1.x - dx)} ${round(
      p1.y - tangents[i + 1]! * dx,
    )} ${round(p1.x)} ${round(p1.y)}`;
  }
  return d;
}

/** The line closed down to `baseline` (for area washes). */
export function areaPath(points: readonly Point[], baseline: number, smooth = true): string {
  if (!points.length) return '';
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${linePath(points, smooth)}L${round(last.x)} ${round(baseline)}L${round(first.x)} ${round(baseline)}Z`;
}

function monotoneTangents(points: readonly Point[]): number[] {
  const n = points.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1]!.x - points[i]!.x || 1;
    slopes.push((points[i + 1]!.y - points[i]!.y) / dx);
  }
  const tangents = [slopes[0]!];
  for (let i = 1; i < n - 1; i++) {
    const a = slopes[i - 1]!;
    const b = slopes[i]!;
    tangents.push(a * b <= 0 ? 0 : (2 * a * b) / (a + b));
  }
  tangents.push(slopes[n - 2]!);
  return tangents;
}

/**
 * A bar from `base` to `value` (y pixels) with a rounded data-end and a square baseline;
 * downward bars round their bottom end instead.
 */
export function barPath(
  x: number,
  width: number,
  baseY: number,
  valueY: number,
  radius = 4,
): string {
  const top = Math.min(baseY, valueY);
  const height = Math.abs(baseY - valueY);
  if (height < 0.5) return '';
  const r = Math.min(radius, width / 2, height);
  const up = valueY <= baseY;
  const left = round(x);
  const right = round(x + width);
  if (up) {
    const bottom = round(top + height);
    return `M${left} ${bottom}V${round(top + r)}Q${left} ${round(top)} ${round(x + r)} ${round(top)}H${round(
      x + width - r,
    )}Q${right} ${round(top)} ${right} ${round(top + r)}V${bottom}Z`;
  }
  const bottom = top + height;
  return `M${left} ${round(top)}V${round(bottom - r)}Q${left} ${round(bottom)} ${round(x + r)} ${round(
    bottom,
  )}H${round(x + width - r)}Q${right} ${round(bottom)} ${right} ${round(bottom - r)}V${round(top)}Z`;
}

/** Horizontal bar growing right from `x0`, rounded at the data-end. */
export function hbarPath(
  x0: number,
  y: number,
  length: number,
  height: number,
  radius = 4,
): string {
  if (length < 0.5) return '';
  const r = Math.min(radius, height / 2, length);
  const x1 = x0 + length;
  return `M${round(x0)} ${round(y)}H${round(x1 - r)}Q${round(x1)} ${round(y)} ${round(x1)} ${round(
    y + r,
  )}V${round(y + height - r)}Q${round(x1)} ${round(y + height)} ${round(x1 - r)} ${round(
    y + height,
  )}H${round(x0)}Z`;
}

/** A donut segment from angle a0 to a1 (radians, 0 = 12 o'clock, clockwise). */
export function arcPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  a0: number,
  a1: number,
): string {
  const sweep = a1 - a0;
  if (sweep <= 0) return '';
  if (sweep >= Math.PI * 2 - 1e-6) {
    // Full ring: two half arcs.
    const mid = a0 + Math.PI;
    return `${arcPath(cx, cy, outer, inner, a0, mid)}${arcPath(cx, cy, outer, inner, mid, a0 + Math.PI * 2 - 1e-6)}`;
  }
  const large = sweep > Math.PI ? 1 : 0;
  const pt = (radius: number, angle: number) =>
    `${round(cx + radius * Math.sin(angle))} ${round(cy - radius * Math.cos(angle))}`;
  return `M${pt(outer, a0)}A${outer} ${outer} 0 ${large} 1 ${pt(outer, a1)}L${pt(inner, a1)}A${inner} ${inner} 0 ${large} 0 ${pt(
    inner,
    a0,
  )}Z`;
}

/**
 * Donut segments for values, with a `gap` (radians) between neighbours so touching slices are
 * separated by surface, never a stroke. Zero values draw nothing.
 */
export function donutSegments(values: readonly number[], gap = 0.03) {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return values.map(() => null);
  const visible = values.filter((value) => value > 0).length;
  const usable = Math.PI * 2 - (visible > 1 ? gap * visible : 0);
  let angle = 0;
  return values.map((value) => {
    if (value <= 0) return null;
    const sweep = (value / total) * usable;
    const segment = { start: angle, end: angle + sweep, share: value / total };
    angle += sweep + (visible > 1 ? gap : 0);
    return segment;
  });
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Index of the band nearest an x position (for crosshair hover). */
export function nearestIndex(x: number, count: number, width: number): number {
  if (count <= 1) return 0;
  const step = width / count;
  return Math.max(0, Math.min(count - 1, Math.floor(x / step)));
}
