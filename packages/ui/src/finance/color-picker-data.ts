export const entityColorSwatches = [
  { name: 'Lime', value: '#B7FF4A' },
  { name: 'Sky', value: '#71B8FF' },
  { name: 'Coral', value: '#FF7777' },
  { name: 'Violet', value: '#BA8AFF' },
  { name: 'Amber', value: '#FFD44F' },
  { name: 'Orange', value: '#FF9C5B' },
  { name: 'Mint', value: '#54D6A1' },
  { name: 'Rose', value: '#FF80B6' },
] as const;

export const colorHueOptions = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as const;

const saturations = [100, 82, 64, 46, 28, 10];
const lightnesses = [94, 80, 66, 52, 38, 24];

export function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - chroma / 2;
  const [red, green, blue] =
    h < 60
      ? [chroma, x, 0]
      : h < 120
        ? [x, chroma, 0]
        : h < 180
          ? [0, chroma, x]
          : h < 240
            ? [0, x, chroma]
            : h < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + m) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();
}

export function getColorToneSwatches(hue: number): string[] {
  return lightnesses.flatMap((lightness) =>
    saturations.map((saturation) => hslToHex(hue, saturation, lightness)),
  );
}
