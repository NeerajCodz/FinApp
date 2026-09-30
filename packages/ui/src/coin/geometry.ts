import earcut from 'earcut';

export type CoinMesh = { vertices: Float32Array<ArrayBuffer>; vertexCount: number };
type Point = readonly [number, number, number];
type Color = readonly [number, number, number];

const volt: Color = [183 / 255, 1, 74 / 255];
const groove: Color = [0.4, 0.57, 0.17];
const black: Color = [0.008, 0.01, 0.006];
const engravingWall: Color = [0.14, 0.19, 0.055];

/** Thin, flat faces with shallow milled rings and a real recessed F on both sides.
 * The face is triangulated around the letter hole; its black floor sits inside the coin. */
export function createCoinMesh(): CoinMesh {
  const vertices: number[] = [];
  const triangle = (a: Point, b: Point, c: Point, color: Color) => {
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2];
    const vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length === 0) return;
    for (const p of [a, b, c]) vertices.push(...p, nx / length, ny / length, nz / length, ...color);
  };
  const segments = 512;
  const profile: readonly (readonly [number, number])[] = [
    [0.78, 0.047],
    [0.825, 0.047],
    [0.832, 0.043],
    [0.845, 0.043],
    [0.852, 0.047],
    [0.905, 0.047],
    [0.912, 0.043],
    [0.923, 0.043],
    [0.93, 0.047],
    [0.979, 0.047],
    [1, 0.035],
    [1, -0.035],
    [0.979, -0.047],
    [0.93, -0.047],
    [0.923, -0.043],
    [0.912, -0.043],
    [0.905, -0.047],
    [0.852, -0.047],
    [0.845, -0.043],
    [0.832, -0.043],
    [0.825, -0.047],
    [0.78, -0.047],
  ];
  const point = (radius: number, z: number, segment: number): Point => {
    const angle = (segment / segments) * Math.PI * 2;
    const edgeRadius =
      radius === 1 ? radius - (segment % 4 === 1 || segment % 4 === 2 ? 0.006 : 0) : radius;
    return [Math.cos(angle) * edgeRadius, Math.sin(angle) * edgeRadius, z];
  };
  for (let ring = 0; ring < profile.length - 1; ring++) {
    const [r1, z1] = profile[ring]!;
    const [r2, z2] = profile[ring + 1]!;
    const color = Math.abs(z1) === 0.043 && Math.abs(z2) === 0.043 ? groove : volt;
    for (let segment = 0; segment < segments; segment++) {
      const a = point(r1, z1, segment),
        b = point(r2, z2, segment);
      const c = point(r2, z2, segment + 1),
        d = point(r1, z1, segment + 1);
      triangle(a, b, c, color);
      triangle(a, c, d, color);
    }
  }

  // The outline is the union of the F's stem, top bar, and middle bar.
  const letter = [
    -0.31, -0.47, -0.09, -0.47, -0.09, -0.025, 0.23, -0.025, 0.23, 0.17, -0.09, 0.17, -0.09, 0.26,
    0.34, 0.26, 0.34, 0.47, -0.31, 0.47,
  ];
  const face: number[] = [];
  const faceSegments = 256;
  for (let index = 0; index < faceSegments; index++) {
    const angle = (index / faceSegments) * Math.PI * 2;
    face.push(Math.cos(angle) * 0.78, Math.sin(angle) * 0.78);
  }
  face.push(...letter);
  const faceIndices = earcut(face, [faceSegments]);
  const floor = letter.map((coordinate) => coordinate * 0.975);
  const floorIndices = earcut(floor);
  for (const side of [1, -1]) {
    for (const [points, indices, depth, color] of [
      [face, faceIndices, 0.047, volt],
      [floor, floorIndices, 0.022, black],
    ] as const) {
      for (let index = 0; index < indices.length; index += 3) {
        for (let corner = 0; corner < 3; corner++) {
          const vertex = indices[index + corner]! * 2;
          vertices.push(
            points[vertex]! * side,
            points[vertex + 1]!,
            depth * side,
            0,
            0,
            side,
            ...color,
          );
        }
      }
    }
    for (let index = 0; index < letter.length; index += 2) {
      const next = (index + 2) % letter.length;
      const a: Point = [letter[index]! * side, letter[index + 1]!, 0.047 * side];
      const b: Point = [letter[next]! * side, letter[next + 1]!, 0.047 * side];
      const c: Point = [floor[next]! * side, floor[next + 1]!, 0.022 * side];
      const d: Point = [floor[index]! * side, floor[index + 1]!, 0.022 * side];
      triangle(a, b, c, engravingWall);
      triangle(a, c, d, engravingWall);
    }
  }
  return { vertices: new Float32Array(vertices), vertexCount: vertices.length / 9 };
}
