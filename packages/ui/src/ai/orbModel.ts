/**
 * Platform-neutral frame model for the Thinking Orb, ported from Thinking Orbs
 * (https://thinkingorbs.com, `@yogesharc/thinking-orbs` 0.1.2, `orb-core.ts`).
 *
 * MIT License, Copyright (c) 2026 Yogesh. Permission is hereby granted, free of charge, to any
 * person obtaining a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY
 * KIND, EXPRESS OR IMPLIED.
 *
 * Only the default looks of the states FinApp uses are ported (idle, working, reasoning,
 * searching, waiting), drawn as dots on a Fibonacci sphere. The web uses the original package;
 * native renders these frames with react-native-svg.
 */

export const thinkingOrbStates = ['reasoning', 'working', 'searching', 'waiting', 'idle'] as const;
export type ThinkingOrbState = (typeof thinkingOrbStates)[number];

/** Shared props of `ThinkingOrb` on native and web. */
export type ThinkingOrbProps = {
  state?: ThinkingOrbState;
  /** Width and height in px; orbs are tuned to read at 20. */
  size?: number;
  /** Announced to screen readers; without it the orb is decorative. */
  label?: string;
  /** Shown beside the orb (e.g. "Reading your bill…"). */
  caption?: string;
  paused?: boolean;
};

export type OrbDot = { x: number; y: number; r: number; a: number };

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const ease = (x: number) => (1 - Math.cos(Math.PI * x)) / 2;
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};
type Vec = [number, number, number];
const dist2 = (a: Vec, b: Vec) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

const PERIOD: Record<ThinkingOrbState, number> = {
  idle: 6500,
  working: 3000,
  reasoning: 6500,
  searching: 13000,
  waiting: 13000,
};

/** The k points nearest pts[i], nearest first. */
function nearest(pts: Vec[], i: number, k: number): number[] {
  const idx: number[] = [];
  const d: number[] = [];
  const p = pts[i]!;
  for (let j = 0; j < pts.length; j++) {
    if (j === i) continue;
    const e = dist2(p, pts[j]!);
    let at = idx.length;
    if (at === k) {
      if (e >= d[k - 1]!) continue;
      at--;
    }
    while (at > 0 && d[at - 1]! > e) {
      idx[at] = idx[at - 1]!;
      d[at] = d[at - 1]!;
      at--;
    }
    idx[at] = j;
    d[at] = e;
  }
  return idx;
}

const RING_AXIS: Vec = (() => {
  const tip = (30 * Math.PI) / 180;
  const roll = (10 * Math.PI) / 180;
  return [-Math.sin(roll) * Math.cos(tip), Math.cos(roll) * Math.cos(tip), Math.sin(tip)];
})();

const LENS_MS = 1800;
const MOVE = 0.4;
const LENS = 0.6;
function spot(k: number): Vec {
  const phi = k * 2.45 + hash(k) * 1.5;
  const theta = ((15 + 30 * hash(k + 0.5)) * Math.PI) / 180;
  return [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
}
function lensAt(t: number): Vec {
  const k = Math.floor(t / LENS_MS);
  const u = t / LENS_MS - k;
  const e = u < MOVE ? (1 - Math.cos((u / MOVE) * Math.PI)) / 2 : 1;
  const a = spot(k);
  const b = spot(k + 1);
  const v = a.map((ai, j) => ai + (b[j]! - ai) * e) as Vec;
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map((vi) => vi / n) as Vec;
}

const HOP = 220;
const TAIL = 5;
const REACH = 24;
const WALK = 16;

/**
 * A stateful orb: `frame(t)` returns every dot's position (px), radius and opacity at `t` ms of
 * the animation clock (already scaled by speed).
 */
export function createOrbModel(state: ThinkingOrbState, size: number) {
  const count = Math.max(8, Math.round(size * 4));
  const c = size / 2;
  const R = c * 0.8;
  const rs = (size / 64) ** 0.6 * 0.72;
  const pts: Vec[] = Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(1 - y * y);
    const th = i * GOLDEN;
    return [r * Math.cos(th), y, r * Math.sin(th)];
  });
  const reasoning = state === 'reasoning' && pts.length > 1;
  const near = reasoning ? pts.map((_, i) => nearest(pts, i, REACH)) : [];
  const walk: number[] = [];
  let hops = 0;
  const tilt = (20 * Math.PI) / 180;
  const st = Math.sin(tilt);
  const ct = Math.cos(tilt);

  function frame(t: number): OrbDot[] {
    const period = PERIOD[state];
    const yaw = (t / period) * TAU;
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    const facing = (k: number) => pts[k]![1] * st + (-pts[k]![0] * sy + pts[k]![2] * cy) * ct;
    const lit = new Map<number, number>();
    if (reasoning) {
      const s = t / HOP;
      const n = Math.floor(s);
      const f = s - n;
      if (!walk.length)
        walk.push([...pts.keys()].reduce((b, k) => (facing(k) > facing(b) ? k : b), 0));
      // The clock may loop back to 0; restart the walk's step count rather than stalling.
      hops = n < hops ? Math.max(0, n - WALK) : Math.max(hops, n - WALK);
      for (; hops < n; hops++) {
        const recent = walk.slice(-8);
        const from = walk[walk.length - 1]!;
        let best = -1;
        let score = -Infinity;
        near[from]!.forEach((k, j) => {
          const sc = facing(k) + 0.35 * hash(hops * 31 + j);
          if (!recent.includes(k) && sc > score) {
            score = sc;
            best = k;
          }
        });
        walk.push(best < 0 ? near[from]![0]! : best);
        if (walk.length > WALK) walk.shift();
      }
      for (let j = TAIL - 1; j >= 0; j--) {
        const k = walk[walk.length - 1 - j];
        if (k === undefined) continue;
        const v = j === 0 ? ease(Math.min(1, f * 2)) : 1 - (j - 1 + f) / TAIL;
        lit.set(k, Math.max(lit.get(k) ?? 0, v));
      }
    }
    const head = (t / 2000) * TAU + yaw;
    const ahead = TAU / 2000 + TAU / period;
    const headLat = (tt: number) => ((70 * Math.PI) / 180) * (1 - 2 * ((tt % 6000) / 6000));
    const glow = Math.min(1, 3 * Math.sin(Math.PI * ((t % 6000) / 6000)));
    const lens = state === 'searching' ? lensAt(t) : null;

    return pts.map(([x, y, z], i) => {
      const z1 = -x * sy + z * cy;
      let vx = x * cy + z * sy;
      let vy = y * ct - z1 * st;
      const vz = y * st + z1 * ct;
      const d = (vz + 1) / 2;
      let r = (0.5 + 1.4 * d) * rs;
      let a = Math.max(0, (d - 0.3) / 0.7);
      if (lens) {
        const ang = Math.acos(
          Math.min(1, (vx * lens[0] + vy * lens[1] + vz * lens[2]) / Math.hypot(vx, vy, vz)),
        );
        const w = ang < LENS ? (1 - (ang / LENS) ** 2) ** 2 : 0;
        a *= 1 - 0.55 * (1 - w);
        if (size <= 24) r *= 1 + 0.5 * w;
        if (w) {
          vx *= 1 + 0.12 * w;
          vy *= 1 + 0.12 * w;
          vx += (vx - lens[0]) * 0.35 * w;
          vy += (vy - lens[1]) * 0.35 * w;
          r *= 1 + 0.9 * w;
          a += (1 - a) * w;
        }
      }
      if (state === 'working') {
        const u = t % 1700;
        const at = 1.3 - 2.6 * ease(Math.min(1, u / 1200));
        const q = vx * RING_AXIS[0] + vy * RING_AXIS[1] + vz * RING_AXIS[2];
        const g = u < 1200 ? Math.exp(-(((q - at) / 0.2) ** 2)) : 0;
        r *= 1 + 0.6 * g;
        a += (1 - a) * g;
        const w =
          Math.min(1, Math.max(0, (q - at) / 0.2)) *
          (u < 1200 ? 1 : 1 - Math.min(1, 1.6 * ((u - 1200) / 800)));
        vx *= 1 - 0.08 * w;
        vy *= 1 - 0.08 * w;
        r *= 1 - 0.15 * w;
      }
      if (reasoning) {
        const spark = lit.get(i) ?? 0;
        a *= 0.5;
        if (spark) {
          r *= 1 + 0.8 * spark;
          a += (1 - a) * spark;
        }
      }
      if (state === 'waiting') {
        const lat = Math.asin(y / (Math.hypot(x, y, z) || 1));
        const lon = Math.atan2(z, x);
        const off = Math.atan2(Math.sin(lon - head), Math.cos(lon - head));
        const along = off * Math.cos(lat);
        const g =
          Math.exp(-(((lat - headLat(t + off / ahead)) / 0.28) ** 2)) *
          Math.exp(-((along / (off * ahead > 0 ? 0.12 : 1)) ** 2));
        const w = glow * g ** 0.6;
        a = a * 0.5 + (1 - a * 0.5) * w;
        r *= 1 + 1.1 * w;
      }
      return { x: c + vx * R, y: c - vy * R, r: Math.max(0.45, r), a: Math.min(1, a) };
    });
  }
  return { count, frame };
}
