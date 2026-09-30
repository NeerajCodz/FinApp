import { createCoinMesh } from './geometry';

const vertexSource = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat3 uRotation;
uniform float uFloat;
uniform float uAspect;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vPosition;
void main() {
  vec3 position = uRotation * aPosition + vec3(0., uFloat, -3.6);
  vPosition = position;
  vNormal = uRotation * aNormal;
  vColor = aColor;
  gl_Position = vec4(position.x * 2.6 / uAspect, position.y * 2.6,
    -1.020202 * position.z - 0.2020202, -position.z);
}`;
const fragmentSource = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vPosition;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 light = normalize(vec3(-0.65, 0.9, 1.4));
  vec3 viewDirection = normalize(-vPosition);
  float diffuse = max(dot(normal, light), 0.);
  float rimLight = max(dot(normal, normalize(vec3(0.9, -0.1, -0.5))), 0.);
  float specular = pow(max(dot(normal, normalize(light + viewDirection)), 0.), 42.);
  float metallic = step(0.1, vColor.g);
  vec3 color = vColor * (0.46 + diffuse * 0.54 + rimLight * 0.22);
  color += vec3(0.85, 1., 0.68) * specular * 0.48 * metallic;
  gl_FragColor = vec4(color, 1.);
}`;

export type CoinRenderer = {
  render: (offsetY: number, width: number, height: number) => void;
  dispose: () => void;
};

/** Browser WebGL and Expo GLView share the same flat engraving and fixed camera pose. */
export function createCoinRenderer(gl: WebGLRenderingContext): CoinRenderer {
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  const dispose = () => {
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
    buffer = null;
    program = null;
    shaders.length = 0;
  };
  try {
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vertexSource],
      [gl.FRAGMENT_SHADER, fragmentSource],
    ] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Coin shader allocation failed.');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) ?? 'Coin shader compilation failed.');
      }
    }
    program = gl.createProgram();
    if (!program) throw new Error('Coin program allocation failed.');
    for (const shader of shaders) gl.attachShader(program, shader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? 'Coin program linking failed.');
    }
    gl.useProgram(program);
    const mesh = createCoinMesh();
    buffer = gl.createBuffer();
    if (!buffer) throw new Error('Coin geometry allocation failed.');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
    for (const [name, offset] of [
      ['aPosition', 0],
      ['aNormal', 12],
      ['aColor', 24],
    ] as const) {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 36, offset);
    }
    const rotation = gl.getUniformLocation(program, 'uRotation');
    const floating = gl.getUniformLocation(program, 'uFloat');
    const aspect = gl.getUniformLocation(program, 'uAspect');
    // Fixed pose only. Animation can translate the coin, never rotate it.
    const x = -0.1,
      y = -0.24,
      z = 0.025;
    const sx = Math.sin(x),
      cx = Math.cos(x);
    const sy = Math.sin(y),
      cy = Math.cos(y);
    const sz = Math.sin(z),
      cz = Math.cos(z);
    const matrix = new Float32Array([
      cz * cy - sz * sx * sy,
      sz * cy + cz * sx * sy,
      -cx * sy,
      -sz * cx,
      cz * cx,
      sx,
      cz * sy + sz * sx * cy,
      sz * sy - cz * sx * cy,
      cx * cy,
    ]);
    gl.uniformMatrix3fv(rotation, false, matrix);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    return {
      render(offsetY, width, height) {
        if (!program || width <= 0 || height <= 0) return;
        gl.viewport(0, 0, width, height);
        gl.useProgram(program);
        gl.uniform1f(floating, offsetY);
        gl.uniform1f(aspect, width / height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
        gl.flush();
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
