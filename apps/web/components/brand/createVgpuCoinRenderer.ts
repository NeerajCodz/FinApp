import { draw, effect, frame, geometry, init, sampler, surface, target } from 'vgpu';
import type { Draw, Effect, Geometry, Gpu, Surface, Target } from 'vgpu';
import { createCoinMesh, type CoinInteraction, type CoinRenderer } from '@finapp/ui/coin';

const coinShader = `
struct CoinParams {
  aspect: f32,
  offsetY: f32,
  rotationX: f32,
  rotationY: f32,
  lightX: f32,
  lightY: f32,
}
@group(0) @binding(0) var<uniform> params: CoinParams;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) color: vec3f,
  @location(2) viewPosition: vec3f,
}

fn rotateCoin(value: vec3f) -> vec3f {
  let x = -0.1 + params.rotationX;
  let y = -0.24 + params.rotationY;
  let z = 0.025;
  let sx = sin(x);
  let cx = cos(x);
  let sy = sin(y);
  let cy = cos(y);
  let sz = sin(z);
  let cz = cos(z);
  let rotatedX = vec3f(value.x, value.y * cx - value.z * sx, value.y * sx + value.z * cx);
  let rotatedY = vec3f(rotatedX.x * cy + rotatedX.z * sy, rotatedX.y, -rotatedX.x * sy + rotatedX.z * cy);
  return vec3f(cz * rotatedY.x - sz * rotatedY.y, sz * rotatedY.x + cz * rotatedY.y, rotatedY.z);
}

@vertex fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) color: vec3f,
) -> VertexOut {
  let rotated = rotateCoin(position);
  let viewPosition = rotated + vec3f(0.0, params.offsetY, -3.6);
  var out: VertexOut;
  out.position = vec4f(
    viewPosition.x * 2.6 / params.aspect,
    viewPosition.y * 2.6,
    -1.010101 * viewPosition.z - 0.1010101,
    -viewPosition.z,
  );
  out.normal = normalize(rotateCoin(normal));
  out.color = color;
  out.viewPosition = viewPosition;
  return out;
}

@fragment fn fs_main(
  @location(0) normalValue: vec3f,
  @location(1) colorValue: vec3f,
  @location(2) viewPosition: vec3f,
) -> @location(0) vec4f {
  let normal = normalize(normalValue);
  let lightPosition = vec3f(params.lightX * 4.2, params.lightY * 3.4, 0.2);
  let lightDirection = normalize(lightPosition - viewPosition);
  let viewDirection = normalize(-viewPosition);
  let diffuse = max(dot(normal, lightDirection), 0.0);
  let rimLight = max(dot(normal, normalize(vec3f(0.9, -0.1, -0.5))), 0.0);
  let specular = pow(max(dot(normal, normalize(lightDirection + viewDirection)), 0.0), 42.0);
  let metallic = select(0.0, 1.0, colorValue.g > 0.1);
  let shadowedDiffuse = diffuse * smoothstep(-0.35, 0.15, dot(normal, lightDirection));
  var color = colorValue * (0.4 + shadowedDiffuse * 0.62 + rimLight * 0.18);
  color += vec3f(0.85, 1.0, 0.68) * specular * 0.52 * metallic;
  return vec4f(color, 1.0);
}
`;

const shadowShader = `
struct ShadowParams {
  lightX: f32,
  lightY: f32,
  offsetY: f32,
  rotationY: f32,
}
@group(0) @binding(0) var<uniform> params: ShadowParams;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let center = vec2f(0.5 - params.lightX * 0.045, 0.67 + params.offsetY * 0.3 + params.lightY * 0.035);
  let local = (uv - center) / vec2f(0.31, 0.058);
  let softness = exp(-dot(local, local) * 2.4);
  let edgeFade = clamp(1.0 - abs(params.rotationY) * 0.045, 0.3, 1.0);
  let alpha = softness * 0.42 * edgeFade;
  return vec4f(vec3f(0.035, 0.065, 0.008) * alpha, alpha);
}
`;

const compositeShader = `
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSampleLevel(source, sourceSampler, uv, 0.0);
}
`;

export async function createVgpuCoinRenderer(canvas: HTMLCanvasElement): Promise<CoinRenderer> {
  let gpu: Gpu | undefined;
  let canvasSurface: Surface | undefined;
  let scene: Target | undefined;
  let mesh: Geometry | undefined;
  let coin: Draw | undefined;
  let shadow: Effect | undefined;
  let composite: Effect | undefined;
  let unsubscribeResize: (() => void) | undefined;

  const dispose = () => {
    unsubscribeResize?.();
    canvasSurface?.dispose();
    mesh?.destroy();
    gpu?.dispose();
    unsubscribeResize = undefined;
    canvasSurface = undefined;
    scene = undefined;
    mesh = undefined;
    coin = undefined;
    shadow = undefined;
    composite = undefined;
    gpu = undefined;
  };

  try {
    gpu = await init({ powerPreference: 'low-power' });
    canvasSurface = surface(gpu, canvas, {
      alphaMode: 'premultiplied',
      clearColor: [0, 0, 0, 0],
      dpr: [1, 2],
    });
    scene = target(gpu, {
      size: [Math.max(1, canvasSurface.size[0]), Math.max(1, canvasSurface.size[1])],
      format: canvasSurface.format,
      depth: true,
      msaa: true,
      clearColor: [0, 0, 0, 0],
      label: 'finapp-coin-scene',
    });
    const coinMesh = createCoinMesh();
    mesh = geometry(gpu, {
      label: 'finapp-coin-engraving',
      buffers: [
        {
          data: coinMesh.vertices,
          stride: 36,
          attributes: {
            position: 'float32x3',
            normal: 'float32x3',
            color: 'float32x3',
          },
        },
      ],
      vertexCount: coinMesh.vertexCount,
    });
    coin = draw(gpu, { shader: coinShader, geometry: mesh, label: 'finapp-coin', cull: 'none' });
    shadow = effect(gpu, shadowShader, {
      label: 'finapp-coin-cursor-shadow',
      blend: 'premultiplied',
    });
    composite = effect(gpu, compositeShader, {
      label: 'finapp-coin-composite',
      set: { source: scene, sourceSampler: sampler(gpu) },
    });
    unsubscribeResize = canvasSurface.onResize(({ width, height }) =>
      scene?.resize([width, height]),
    );
    const outputSignature = { colors: [canvasSurface.format] as const, sampleCount: 1 as const };
    await coin.compile(scene);
    await shadow.compile(outputSignature);
    await composite.compile(outputSignature);

    return {
      render(offsetY, _width, _height, interaction: Partial<CoinInteraction> = {}) {
        if (!gpu || !canvasSurface || !scene || !coin || !shadow || !composite || gpu.disposed)
          return;
        const lightX = interaction.lightX ?? 0;
        const lightY = interaction.lightY ?? 0;
        const rotationX = interaction.rotationX ?? 0;
        const rotationY = interaction.rotationY ?? 0;
        shadow.set({ params: { lightX, lightY, offsetY, rotationY } });
        coin.set({
          params: {
            aspect: Math.max(0.001, canvasSurface.size[0] / canvasSurface.size[1]),
            offsetY,
            rotationX,
            rotationY,
            lightX,
            lightY,
          },
        });
        frame(gpu, (currentFrame) => {
          currentFrame.pass({ target: scene!, clear: [0, 0, 0, 0] }, (pass) => pass.draw(coin!));
          currentFrame.pass({ target: canvasSurface!, clear: [0, 0, 0, 0] }, (pass) => {
            pass.draw(composite!);
            pass.draw(shadow!);
          });
        });
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
