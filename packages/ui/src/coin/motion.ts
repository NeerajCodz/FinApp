import { animate } from 'animejs';
export type CoinAngularVelocity = { x: number; y: number };

type CoinRotation = { rotationX: number; rotationY: number };

const dragSensitivity = 0.012;
const maximumAngularVelocity = 8;
const spinDamping = 4.2;
const spinStopThreshold = 0.025;

export function applyCoinDrag(
  rotation: CoinRotation,
  velocity: CoinAngularVelocity,
  deltaX: number,
  deltaY: number,
  deltaSeconds: number,
): void {
  rotation.rotationY += deltaX * dragSensitivity;
  rotation.rotationX -= deltaY * dragSensitivity;
  const elapsed = Math.max(1 / 240, Math.min(deltaSeconds, 0.1));
  const targetX = Math.max(
    -maximumAngularVelocity,
    Math.min(maximumAngularVelocity, (-deltaY * dragSensitivity) / elapsed),
  );
  const targetY = Math.max(
    -maximumAngularVelocity,
    Math.min(maximumAngularVelocity, (deltaX * dragSensitivity) / elapsed),
  );
  velocity.x = targetX;
  velocity.y = targetY;
}

export function hasCoinMomentum(velocity: CoinAngularVelocity): boolean {
  return Math.abs(velocity.x) > spinStopThreshold || Math.abs(velocity.y) > spinStopThreshold;
}

export function stopCoinMomentum(velocity: CoinAngularVelocity): void {
  velocity.x = 0;
  velocity.y = 0;
}
export function releaseCoinMomentum(
  velocity: CoinAngularVelocity,
  secondsSinceLastMovement: number,
): void {
  const damping = Math.exp(-spinDamping * Math.max(0, secondsSinceLastMovement));
  velocity.x *= damping;
  velocity.y *= damping;
  if (Math.abs(velocity.x) <= spinStopThreshold) velocity.x = 0;
  if (Math.abs(velocity.y) <= spinStopThreshold) velocity.y = 0;
}

export function advanceCoinSpin(
  rotation: CoinRotation,
  velocity: CoinAngularVelocity,
  deltaSeconds: number,
): boolean {
  const elapsed = Math.max(0, Math.min(deltaSeconds, 0.1));
  rotation.rotationX += velocity.x * elapsed;
  rotation.rotationY += velocity.y * elapsed;
  const damping = Math.exp(-spinDamping * elapsed);
  velocity.x *= damping;
  velocity.y *= damping;
  if (Math.abs(velocity.x) <= spinStopThreshold) velocity.x = 0;
  if (Math.abs(velocity.y) <= spinStopThreshold) velocity.y = 0;
  return hasCoinMomentum(velocity);
}

/** Manually sampled Anime.js motion works in both browser canvas and Expo GLView.
 * No DOM target, global engine mutation, or rotation channel is involved. */
export function createCoinFloat() {
  const position = { y: 0 };
  const animation = animate(position, {
    y: [-0.035, 0.035],
    duration: 3200,
    alternate: true,
    loop: true,
    autoplay: false,
    ease: 'inOutSine',
  });
  return {
    sample(seconds: number) {
      animation.seek((seconds * 1000) % 6400, true);
      return position.y;
    },
    dispose() {
      animation.cancel();
    },
  };
}
