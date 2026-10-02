import { describe, expect, it } from 'vitest';
import {
  advanceCoinSpin,
  applyCoinDrag,
  releaseCoinMomentum,
  hasCoinMomentum,
  type CoinAngularVelocity,
} from '../../packages/ui/src/coin/motion';

describe('coin drag momentum', () => {
  it('continues a flick after release, slows down, then settles', () => {
    const rotation = { rotationX: 0, rotationY: 0 };
    const velocity: CoinAngularVelocity = { x: 0, y: 0 };

    applyCoinDrag(rotation, velocity, 100, 0, 0.1);
    expect(rotation.rotationY).toBeCloseTo(1.2);
    expect(hasCoinMomentum(velocity)).toBe(true);
    const draggedVelocity = velocity.y;
    releaseCoinMomentum(velocity, 0.1);
    expect(velocity.y).toBeLessThan(draggedVelocity);

    const releasedVelocity = velocity.y;
    const releaseAngle = rotation.rotationY;
    expect(advanceCoinSpin(rotation, velocity, 0.1)).toBe(true);
    expect(rotation.rotationY).toBeGreaterThan(releaseAngle);
    expect(velocity.y).toBeLessThan(releasedVelocity);

    for (let frame = 0; frame < 30 && hasCoinMomentum(velocity); frame++) {
      advanceCoinSpin(rotation, velocity, 0.1);
    }

    expect(hasCoinMomentum(velocity)).toBe(false);
    const settledAngle = rotation.rotationY;
    advanceCoinSpin(rotation, velocity, 0.1);
    expect(rotation.rotationY).toBe(settledAngle);
  });

  it('preserves drag direction and does not create spin for a stationary pointer', () => {
    const rotation = { rotationX: 0, rotationY: 0 };
    const velocity: CoinAngularVelocity = { x: 0, y: 0 };

    applyCoinDrag(rotation, velocity, 0, 10, 0.1);
    expect(rotation.rotationX).toBeLessThan(0);
    expect(velocity.x).toBeLessThan(0);

    const verticalAngle = rotation.rotationX;
    applyCoinDrag(rotation, velocity, 0, 0, 0.1);
    expect(rotation.rotationX).toBe(verticalAngle);
    expect(hasCoinMomentum(velocity)).toBe(false);
  });
});
