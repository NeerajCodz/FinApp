/**
 * The FinAI mark: an orbit ring with a gap (the "coin" of FinApp, opened up), a four-point
 * spark at its centre and a small spark sitting in the gap. Shared geometry for the web and
 * native components; colours come from the theme (ring = foreground, spark = primary).
 *
 * viewBox 0 0 32 32.
 */
export const FINAI_LOGO = {
  viewBox: '0 0 32 32',
  /** Ring: a 310° arc of r=12 around (16,16), open at the top right. */
  ring: 'M26.88 10.93A12 12 0 1 1 19.11 4.41',
  ringWidth: 2.6,
  /** Four-point spark in the centre. */
  spark:
    'M16 8.6C16.75 13.1 18.9 15.25 23.4 16C18.9 16.75 16.75 18.9 16 23.4C15.25 18.9 13.1 16.75 8.6 16C13.1 15.25 15.25 13.1 16 8.6Z',
  /** The small spark in the ring's gap. */
  dot: { cx: 23.71, cy: 6.81, r: 1.9 },
} as const;

/** Standalone SVG (for files, favicons or emails). Colours are plain hex here. */
export function finaiLogoSvg(ring = '#F4F4F5', accent = '#B7FF4A'): string {
  const { viewBox, ring: arc, ringWidth, spark, dot } = FINAI_LOGO;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none"><path d="${arc}" stroke="${ring}" stroke-width="${ringWidth}" stroke-linecap="round"/><path d="${spark}" fill="${accent}"/><circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${accent}"/></svg>`;
}
