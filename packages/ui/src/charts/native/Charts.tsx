/**
 * FinApp charts for native: react-native-svg marks, a touch tooltip (tap or drag across the
 * plot), a legend for 2+ series and accessible summaries. Same specs and palette as the web set.
 */
import React from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useTheme } from '../../native/ThemeProvider';
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
  sequentialColor,
  seriesColor,
  valueDomain,
} from '../core';

export type ChartSeries = { id: string; label: string; values: readonly number[]; color?: string };
type Format = (value: number, index?: number) => string;
const plain: Format = (value) => new Intl.NumberFormat().format(Math.round(value));

function useColors() {
  const { tokens, isDark } = useTheme();
  return {
    dark: isDark,
    surface: tokens.background,
    grid: tokens.borderSubtle,
    axis: tokens.foregroundSubtle,
    text: tokens.foreground,
    muted: tokens.foregroundMuted,
    popover: tokens.popover,
    border: tokens.borderSubtle,
    primary: tokens.primary,
    income: tokens.income,
    expense: tokens.expense,
    warning: tokens.warning,
  };
}

function useWidth(fallback = 320) {
  const [width, setWidth] = React.useState(fallback);
  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(Math.max(120, Math.floor(event.nativeEvent.layout.width)));
  return [width, onLayout] as const;
}

export function ChartLegend({
  items,
}: {
  items: readonly { label: string; color: string; value?: string; line?: boolean }[];
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={
              item.line
                ? { width: 14, height: 2, borderRadius: 2, backgroundColor: item.color }
                : { width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }
            }
          />
          <Text style={{ color: colors.muted, fontSize: 12 }}>{item.label}</Text>
          {item.value ? (
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>
              {item.value}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function TooltipCard({
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
  const colors = useColors();
  const cardW = 156;
  const left = Math.min(Math.max(0, x - cardW / 2), Math.max(0, width - cardW));
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -6,
        left,
        width: cardW,
        gap: 4,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.popover,
        shadowColor: '#000000', // theme-exempt: elevation
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '600' }}>{title}</Text>
      {rows.map((row) => (
        <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: row.color }} />
          <Text style={{ color: colors.text, fontSize: 12, flex: 1 }} numberOfLines={1}>
            {row.label}
          </Text>
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const PAD = { top: 10, right: 8, bottom: 24, left: 46 };

function useTouch(count: number, plotWidth: number) {
  const [index, setIndex] = React.useState<number | null>(null);
  const pick = (x: number) => setIndex(nearestIndex(x - PAD.left, count, plotWidth));
  const responder = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: (event: { nativeEvent: { locationX: number } }) =>
      pick(event.nativeEvent.locationX),
    onResponderMove: (event: { nativeEvent: { locationX: number } }) =>
      pick(event.nativeEvent.locationX),
    onResponderTerminationRequest: () => true,
  };
  return { index, setIndex, responder };
}

function Axes({
  ticks,
  y,
  width,
  labels,
  x,
  axisFormat,
  height,
}: {
  ticks: readonly number[];
  y: (value: number) => number;
  width: number;
  labels: readonly string[];
  x: (index: number) => number;
  axisFormat: Format;
  height: number;
}) {
  const colors = useColors();
  const stride = labelStride(labels.length, Math.max(2, Math.floor(width / 48)));
  return (
    <G>
      {ticks.map((tick) => (
        <G key={tick}>
          <Line
            x1={0}
            x2={width}
            y1={y(tick)}
            y2={y(tick)}
            stroke={tick === 0 ? colors.axis : colors.grid}
            strokeWidth={1}
          />
          <SvgText x={-6} y={y(tick) + 4} textAnchor="end" fontSize={10} fill={colors.muted}>
            {axisFormat(tick)}
          </SvgText>
        </G>
      ))}
      {labels.map((label, index) =>
        index % stride === 0 ? (
          <SvgText
            key={`${label}-${index}`}
            x={x(index)}
            y={height + 16}
            textAnchor="middle"
            fontSize={10}
            fill={colors.muted}
          >
            {label}
          </SvgText>
        ) : null,
      )}
    </G>
  );
}

// ---------- Line / area ----------

export function LineChart({
  series,
  labels,
  height = 200,
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
  titles?: readonly string[];
  caption?: string;
  onSelect?: (index: number) => void;
  showLegend?: boolean;
}) {
  const colors = useColors();
  const [width, onLayout] = useWidth();
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const count = labels.length;
  const { domain, ticks } = valueDomain(series.flatMap((s) => s.values));
  const y = linear(domain, [plotH, 0]);
  const x = (index: number) => (count <= 1 ? plotW / 2 : (index / (count - 1)) * plotW);
  const touch = useTouch(count, plotW);
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? seriesColor(i, colors.dark) }));
  const last = count - 1;
  const summary = `${caption}. ${colored
    .map((s) => `${s.label}: ${format(s.values[last] ?? 0, last)} at ${labels[last] ?? ''}`)
    .join('; ')}`;

  return (
    <View style={{ gap: 10 }} onLayout={onLayout}>
      {(showLegend ?? colored.length > 1) ? (
        <ChartLegend items={colored.map((s) => ({ label: s.label, color: s.color, line: true }))} />
      ) : null}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        {...touch.responder}
        onResponderRelease={() => {
          if (touch.index !== null) onSelect?.(touch.index);
          setTimeout(() => touch.setIndex(null), 1600);
        }}
      >
        <Svg width={width} height={height}>
          <Defs>
            {colored.map((s, i) => (
              <LinearGradient key={s.id} id={`area-${i}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={s.color} stopOpacity={0.22} />
                <Stop offset="1" stopColor={s.color} stopOpacity={0} />
              </LinearGradient>
            ))}
          </Defs>
          <G x={PAD.left} y={PAD.top}>
            <Axes
              ticks={ticks}
              y={y}
              width={plotW}
              labels={labels}
              x={x}
              axisFormat={axisFormat}
              height={plotH}
            />
            {colored.map((s, i) => {
              const points = s.values.map((value, index) => ({ x: x(index), y: y(value) }));
              return (
                <G key={s.id}>
                  {area && colored.length <= 2 ? (
                    <Path
                      d={areaPath(points, y(Math.max(domain[0], 0)), smooth)}
                      fill={`url(#area-${i})`}
                    />
                  ) : null}
                  <Path
                    d={linePath(points, smooth)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </G>
              );
            })}
            {touch.index !== null ? (
              <G>
                <Line
                  x1={x(touch.index)}
                  x2={x(touch.index)}
                  y1={0}
                  y2={plotH}
                  stroke={colors.axis}
                  strokeWidth={1}
                />
                {colored.map((s) => (
                  <Circle
                    key={s.id}
                    cx={x(touch.index!)}
                    cy={y(s.values[touch.index!] ?? 0)}
                    r={4.5}
                    fill={s.color}
                    stroke={colors.surface}
                    strokeWidth={2}
                  />
                ))}
              </G>
            ) : null}
          </G>
        </Svg>
        {touch.index !== null ? (
          <TooltipCard
            x={PAD.left + x(touch.index)}
            width={width}
            title={titles?.[touch.index] ?? labels[touch.index] ?? ''}
            rows={colored.map((s) => ({
              label: s.label,
              value: format(s.values[touch.index!] ?? 0, touch.index!),
              color: s.color,
            }))}
          />
        ) : null}
      </View>
    </View>
  );
}

// ---------- Columns ----------

export function ColumnChart({
  series,
  labels,
  mode = 'grouped',
  line,
  height = 220,
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
  mode?: 'grouped' | 'stacked' | 'diverging';
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
  const [width, onLayout] = useWidth();
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const count = labels.length;
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? seriesColor(i, colors.dark) }));
  const lineColor = line?.color ?? colors.text;
  const totals = labels.map((_, index) => {
    let up = 0;
    let down = 0;
    for (const s of colored) {
      const value = s.values[index] ?? 0;
      if (value >= 0) up += value;
      else down += value;
    }
    return { up, down };
  });
  const { domain, ticks } = valueDomain(
    mode === 'stacked'
      ? totals.flatMap((t) => [t.up, t.down])
      : [...colored.flatMap((s) => s.values), ...(line?.values ?? [])],
  );
  const y = linear(domain, [plotH, 0]);
  const zero = y(0);
  const band = bands(
    count,
    plotW,
    mode === 'grouped' ? 20 * Math.max(1, colored.length) : 20,
    mode === 'grouped' ? 0.72 : 0.6,
  );
  const groupBar =
    mode === 'grouped'
      ? Math.max(2, (band.bar - 2 * (colored.length - 1)) / colored.length)
      : band.bar;
  const touch = useTouch(count, plotW);
  const active = touch.index ?? highlightIndex;
  const summary = `${caption}. ${labels.length} periods.`;

  return (
    <View style={{ gap: 10 }} onLayout={onLayout}>
      {(showLegend ?? colored.length + (line ? 1 : 0) > 1) ? (
        <ChartLegend
          items={[
            ...colored.map((s) => ({ label: s.label, color: s.color })),
            ...(line ? [{ label: line.label, color: lineColor, line: true }] : []),
          ]}
        />
      ) : null}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        {...touch.responder}
        onResponderRelease={() => {
          if (touch.index !== null) onSelect?.(touch.index);
          setTimeout(() => touch.setIndex(null), 1600);
        }}
      >
        <Svg width={width} height={height}>
          <G x={PAD.left} y={PAD.top}>
            <Axes
              ticks={ticks}
              y={y}
              width={plotW}
              labels={labels}
              x={band.center}
              axisFormat={axisFormat}
              height={plotH}
            />
            {labels.map((_, index) => {
              let up = 0;
              let down = 0;
              return (
                <G
                  key={index}
                  opacity={active !== undefined && active !== null && active !== index ? 0.45 : 1}
                >
                  {colored.map((s, si) => {
                    const value = s.values[index] ?? 0;
                    if (mode !== 'stacked') {
                      const left =
                        mode === 'grouped'
                          ? band.start(index) + si * (groupBar + 2)
                          : band.start(index);
                      const d = barPath(left, groupBar, zero, y(value));
                      return d ? <Path key={s.id} d={d} fill={s.color} /> : null;
                    }
                    const from = value >= 0 ? up : down;
                    const to = from + value;
                    if (value >= 0) up = to;
                    else down = to;
                    const outer =
                      value >= 0 ? to === totals[index]!.up : to === totals[index]!.down;
                    const gap = from === 0 ? 0 : 1;
                    const d = barPath(
                      band.start(index),
                      band.bar,
                      value >= 0 ? y(from) - gap : y(from) + gap,
                      y(to),
                      outer ? 4 : 0,
                    );
                    return d ? <Path key={s.id} d={d} fill={s.color} /> : null;
                  })}
                </G>
              );
            })}
            {line ? (
              <G>
                <Path
                  d={linePath(
                    line.values.map((value, index) => ({ x: band.center(index), y: y(value) })),
                    false,
                  )}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={2}
                />
                {count <= 40
                  ? line.values.map((value, index) => (
                      <Circle
                        key={index}
                        cx={band.center(index)}
                        cy={y(value)}
                        r={3.5}
                        fill={lineColor}
                        stroke={colors.surface}
                        strokeWidth={2}
                      />
                    ))
                  : null}
              </G>
            ) : null}
          </G>
        </Svg>
        {touch.index !== null ? (
          <TooltipCard
            x={PAD.left + band.center(touch.index)}
            width={width}
            title={titles?.[touch.index] ?? labels[touch.index] ?? ''}
            rows={[
              ...colored.map((s) => ({
                label: s.label,
                value: format(Math.abs(s.values[touch.index!] ?? 0), touch.index!),
                color: s.color,
              })),
              ...(line
                ? [
                    {
                      label: line.label,
                      value: format(line.values[touch.index!] ?? 0, touch.index!),
                      color: lineColor,
                    },
                  ]
                : []),
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

// ---------- Ranked bars ----------

export type RankedItem = {
  id: string;
  label: string;
  value: number;
  display: string;
  color?: string;
  icon?: React.ReactNode;
  detail?: string;
};

export function RankedBars({
  items,
  max,
  onSelect,
}: {
  items: readonly RankedItem[];
  max?: number;
  onSelect?: (item: RankedItem) => void;
}) {
  const colors = useColors();
  const top = max ?? Math.max(0, ...items.map((item) => item.value));
  return (
    <View style={{ gap: 4 }}>
      {items.map((item, index) => {
        const share = top > 0 ? Math.max(0, item.value) / top : 0;
        const color = item.color ?? seriesColor(index, colors.dark);
        return (
          <Pressable
            key={item.id}
            disabled={!onSelect}
            onPress={() => onSelect?.(item)}
            accessibilityRole={onSelect ? 'button' : 'text'}
            accessibilityLabel={`${item.label}: ${item.display}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 8,
              paddingHorizontal: 4,
              borderRadius: 10,
              backgroundColor: pressed ? colors.grid : 'transparent',
            })}
          >
            {item.icon ? (
              <View style={{ width: 26, alignItems: 'center' }}>{item.icon}</View>
            ) : null}
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ color: colors.text, fontSize: 14, flexShrink: 1 }} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>
                  {item.display}
                </Text>
              </View>
              <View
                style={{
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: colors.grid,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${share * 100}%`,
                    height: '100%',
                    borderRadius: 999,
                    backgroundColor: color,
                  }}
                />
              </View>
              {item.detail ? (
                <Text style={{ color: colors.muted, fontSize: 11 }}>{item.detail}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
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
  size = 180,
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
  const share = (value: number) => `${Math.round((Math.max(0, value) / (total || 1)) * 100)}%`;
  return (
    <View style={{ gap: 16 }}>
      <View
        style={{ width: size, height: size, alignSelf: 'center' }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${caption}: ${colored.map((item) => `${item.label} ${share(item.value)}`).join(', ')}`}
      >
        <Svg width={size} height={size}>
          {total <= 0 ? (
            <Circle
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
            return (
              <Path
                key={item.id}
                d={arcPath(c, c, outer, inner, segment.start, segment.end)}
                fill={item.color}
                opacity={active !== null && active !== index ? 0.4 : 1}
                onPress={() => setActive((current) => (current === index ? null : index))}
              />
            );
          })}
        </Svg>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: size * 0.22,
          }}
        >
          <Text
            style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {focus ? focus.display : centerValue}
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}
            numberOfLines={2}
          >
            {focus ? `${focus.label} · ${share(focus.value)}` : centerLabel}
          </Text>
        </View>
      </View>
      {legend ? (
        <View style={{ gap: 2 }}>
          {colored.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() =>
                onSelect
                  ? onSelect(item)
                  : setActive((current) => (current === index ? null : index))
              }
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 7,
                paddingHorizontal: 6,
                borderRadius: 8,
                backgroundColor: pressed || active === index ? colors.grid : 'transparent',
              })}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
              {item.icon ? <View>{item.icon}</View> : null}
              <Text style={{ color: colors.text, fontSize: 13, flex: 1 }} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{share(item.value)}</Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 13,
                  fontWeight: '700',
                  minWidth: 70,
                  textAlign: 'right',
                }}
              >
                {item.display}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---------- Small figures ----------

export function Sparkline({
  values,
  color,
  width = 110,
  height = 34,
  area = true,
}: {
  values: readonly number[];
  color?: string;
  width?: number;
  height?: number;
  area?: boolean;
}) {
  const colors = useColors();
  const stroke = color ?? colors.primary;
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const y = linear([min, max === min ? min + 1 : max], [height - 4, 4]);
  const x = (index: number) =>
    values.length <= 1 ? width / 2 : (index / (values.length - 1)) * (width - 6) + 3;
  const points = values.map((value, index) => ({ x: x(index), y: y(value) }));
  const last = points[points.length - 1]!;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={0.25} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {area ? <Path d={areaPath(points, height)} fill="url(#spark)" /> : null}
      <Path
        d={linePath(points)}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle
        cx={last.x}
        cy={last.y}
        r={3}
        fill={stroke}
        stroke={colors.surface}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

export function SparkBars({
  values,
  color,
  width = 80,
  height = 38,
}: {
  values: readonly number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const colors = useColors();
  const fill = color ?? colors.primary;
  if (!values.length) return null;
  const max = Math.max(...values.map(Math.abs), 1);
  const band = bands(values.length, width, 7, 0.62);
  return (
    <Svg width={width} height={height}>
      {values.map((value, index) => {
        const d = barPath(
          band.start(index),
          band.bar,
          height,
          height - Math.max(2, (Math.abs(value) / max) * (height - 2)),
          2,
        );
        return d ? (
          <Path
            key={index}
            d={d}
            fill={fill}
            opacity={
              index === values.length - 1
                ? 1
                : 0.35 + (0.45 * index) / Math.max(1, values.length - 1)
            }
          />
        ) : null;
      })}
    </Svg>
  );
}

export function Meter({
  value,
  max,
  label,
  detail,
  thin,
  warnAt = 0.8,
}: {
  value: number;
  max: number;
  label?: string;
  detail?: string;
  thin?: boolean;
  /** Share of `max` (0–1) where the fill turns to the warning colour. Default 0.8. */
  warnAt?: number;
}) {
  const colors = useColors();
  const ratio = max > 0 ? value / max : 0;
  const color = ratio > 1 ? colors.expense : ratio >= warnAt ? colors.warning : colors.income;
  return (
    <View
      style={{ gap: 6 }}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: value }}
      accessibilityLabel={label}
    >
      {label || detail ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 12 }}>{label}</Text>
          {detail ? <Text style={{ color: colors.muted, fontSize: 12 }}>{detail}</Text> : null}
        </View>
      ) : null}
      <View
        style={{
          height: thin ? 4 : 8,
          borderRadius: 999,
          overflow: 'hidden',
          backgroundColor: `${color}2E`,
        }}
      >
        <View
          style={{
            width: `${Math.min(1, Math.max(0, ratio)) * 100}%`,
            height: '100%',
            borderRadius: 999,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

export function RingProgress({
  value,
  size = 60,
  stroke = 7,
  color,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const colors = useColors();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  const tone = color ?? colors.primary;
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeOpacity={0.18}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

export function SegmentedBar({
  parts,
  tall,
}: {
  parts: readonly { label: string; value: number; color?: string }[];
  tall?: boolean;
}) {
  const colors = useColors();
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);
  return (
    <View
      style={{ flexDirection: 'row', gap: 2, height: tall ? 28 : 8 }}
      accessible
      accessibilityLabel={parts
        .map((p) => `${p.label} ${Math.round((Math.max(0, p.value) / (total || 1)) * 100)}%`)
        .join(', ')}
    >
      {parts.map((part, index) =>
        part.value > 0 ? (
          <View
            key={part.label}
            style={{
              flexGrow: part.value,
              borderRadius: tall ? 4 : 999,
              backgroundColor: part.color ?? seriesColor(index, colors.dark),
              justifyContent: 'center',
              paddingLeft: 6,
            }}
          >
            {tall && part.value / (total || 1) >= 0.12 ? (
              <Text
                style={{
                  color: '#0b0b0b', // theme-exempt: label inside a coloured fill
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >{`${Math.round((part.value / (total || 1)) * 100)}%`}</Text>
            ) : null}
          </View>
        ) : null,
      )}
    </View>
  );
}

export function Heatmap({
  rows,
  columns,
  format = plain,
  cell = 16,
  onSelect,
}: {
  rows: readonly { label: string; values: readonly number[] }[];
  columns: readonly string[];
  format?: Format;
  cell?: number;
  onSelect?: (row: number, column: number) => void;
}) {
  const colors = useColors();
  const [picked, setPicked] = React.useState<{ r: number; c: number } | null>(null);
  const max = Math.max(0, ...rows.flatMap((row) => row.values));
  const labelW = Math.max(26, ...rows.map((row) => row.label.length * 6.5));
  const gap = 3;
  const width = labelW + columns.length * (cell + gap);
  const height = 16 + rows.length * (cell + gap);
  const stride = labelStride(columns.length, Math.floor((columns.length * (cell + gap)) / 40));
  return (
    <View style={{ gap: 8 }}>
      <Svg width={width} height={height}>
        {columns.map((column, c) =>
          c % stride === 0 ? (
            <SvgText
              key={column + c}
              x={labelW + c * (cell + gap) + cell / 2}
              y={10}
              textAnchor="middle"
              fontSize={10}
              fill={colors.muted}
            >
              {column}
            </SvgText>
          ) : null,
        )}
        {rows.map((row, r) => (
          <G key={row.label + r}>
            <SvgText
              x={labelW - 5}
              y={16 + r * (cell + gap) + cell / 2 + 3}
              textAnchor="end"
              fontSize={10}
              fill={colors.muted}
            >
              {row.label}
            </SvgText>
            {row.values.map((value, c) => (
              <Rect
                key={c}
                x={labelW + c * (cell + gap)}
                y={16 + r * (cell + gap)}
                width={cell}
                height={cell}
                rx={4}
                fill={
                  value > 0 ? sequentialColor(max > 0 ? value / max : 0, colors.dark) : colors.grid
                }
                stroke={picked?.r === r && picked.c === c ? colors.text : 'none'}
                onPress={() => {
                  setPicked({ r, c });
                  onSelect?.(r, c);
                }}
              />
            ))}
          </G>
        ))}
      </Svg>
      {picked ? (
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {rows[picked.r]?.label}, {columns[picked.c]}:{' '}
          {format(rows[picked.r]?.values[picked.c] ?? 0)}
        </Text>
      ) : null}
    </View>
  );
}
