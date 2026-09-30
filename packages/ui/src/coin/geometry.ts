export type CoinMesh = { vertices: Float32Array; vertexCount: number };
type Point = readonly [number, number, number];
type Color = readonly [number, number, number];

const volt: Color = [183 / 255, 1, 74 / 255];
const groove: Color = [0.31, 0.48, 0.09];
const black: Color = [0.008, 0.01, 0.006];

/** Actual beveled surfaces, recessed face grooves, 128 edge reeds, and raised lettering.
 * Interleaved positions/normals/colors upload once; animation never rebuilds the mesh. */
export function createCoinMesh(): CoinMesh {
  const vertices: number[] = [];
  const triangle = (a: Point, b: Point, c: Point, color: Color) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length === 0) return;
    for (const p of [a, b, c]) vertices.push(...p, nx / length, ny / length, nz / length, ...color);
  };
  const segments = 512;
  const profile: readonly (readonly [number, number])[] = [
    [0, 0.15], [0.78, 0.15], [0.80, 0.15],
    [0.812, 0.137], [0.826, 0.137], [0.838, 0.15],
    [0.86, 0.15], [0.873, 0.137], [0.887, 0.137], [0.90, 0.164],
    [0.947, 0.164], [0.971, 0.148], [1.02, 0.092], [1.02, -0.092],
    [0.971, -0.148], [0.947, -0.164], [0.90, -0.164],
    [0.887, -0.137], [0.873, -0.137], [0.86, -0.15],
    [0.838, -0.15], [0.826, -0.137], [0.812, -0.137],
    [0.80, -0.15], [0.78, -0.15], [0, -0.15],
  ];
  const point = (radius: number, z: number, segment: number): Point => {
    const angle = (segment / segments) * Math.PI * 2;
    // A four-segment tooth is a real recessed ridge, not a painted texture.
    const reededRadius = radius > 1 ? radius - (segment % 4 === 1 || segment % 4 === 2 ? 0.024 : 0) : radius;
    return [Math.cos(angle) * reededRadius, Math.sin(angle) * reededRadius, z];
  };
  for (let ring = 0; ring < profile.length - 1; ring++) {
    const [r1, z1] = profile[ring]!;
    const [r2, z2] = profile[ring + 1]!;
    const color = Math.abs(z1) === 0.137 && Math.abs(z2) === 0.137 ? groove : volt;
    for (let segment = 0; segment < segments; segment++) {
      const a = point(r1, z1, segment), b = point(r2, z2, segment);
      const c = point(r2, z2, segment + 1), d = point(r1, z1, segment + 1);
      triangle(a, b, c, color);
      triangle(a, c, d, color);
    }
  }
  const box = (x1: number, x2: number, y1: number, y2: number, z1: number, z2: number) => {
    const p: Point[] = [
      [x1, y1, z1], [x2, y1, z1], [x2, y2, z1], [x1, y2, z1],
      [x1, y1, z2], [x2, y1, z2], [x2, y2, z2], [x1, y2, z2],
    ];
    for (const [a, b, c, d] of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]]) {
      triangle(p[a!]!, p[b!]!, p[c!]!, black);
      triangle(p[a!]!, p[c!]!, p[d!]!, black);
    }
  };
  for (const side of [1, -1]) {
    const letter = (x1: number, x2: number, y1: number, y2: number) =>
      box(Math.min(x1 * side, x2 * side), Math.max(x1 * side, x2 * side), y1, y2,
        side > 0 ? 0.15 : -0.177, side > 0 ? 0.177 : -0.15);
    letter(-0.31, -0.09, -0.47, 0.47);
    letter(-0.09, 0.34, 0.26, 0.47);
    letter(-0.09, 0.23, -0.025, 0.17);
  }
  return { vertices: new Float32Array(vertices), vertexCount: vertices.length / 9 };
}
