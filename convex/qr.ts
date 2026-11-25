/**
 * QR codes as an SVG path (one unit per module), using only qrcode's pure-JS core encoder so it
 * runs in the default Convex runtime. Clients draw it black on white with a quiet zone.
 */
import { create } from 'qrcode/lib/core/qrcode';

export function qrPath(text: string): { size: number; path: string } {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  const size = modules.size;
  let path = '';
  for (let row = 0; row < size; row++) {
    let start = -1;
    for (let col = 0; col <= size; col++) {
      const dark = col < size && Boolean(modules.get(row, col));
      if (dark && start < 0) start = col;
      if (!dark && start >= 0) {
        path += `M${start} ${row}h${col - start}v1h-${col - start}z`;
        start = -1;
      }
    }
  }
  return { size, path };
}
