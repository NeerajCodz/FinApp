import { describe, expect, it } from 'vitest';
import {
  advanceCoinSpin,
  applyCoinDrag,
  createCoinFloat,
  hasCoinMomentum,
  releaseCoinMomentum,
} from '../../packages/ui/src/coin/motion';

describe('coin float', () => {
  it('loads without browser globals and preserves the float cycle', () => {
    const motion = createCoinFloat();

    expect(motion.sample(0)).toBeCloseTo(-0.035);
    expect(motion.sample(1.6)).toBeCloseTo(0);
    expect(motion.sample(3.2)).toBeCloseTo(0.035);
    expect(motion.sample(4.8)).toBeCloseTo(0);
    expect(motion.sample(6.4)).toBeCloseTo(-0.035);
  });

  it('keeps a user drag spinning after release until momentum settles', () => {
    const rotation = { rotationX: 0, rotationY: 0 };
    const velocity = { x: 0, y: 0 };

    applyCoinDrag(rotation, velocity, 30, -15, 0.05);
    expect(rotation.rotationX).toBeGreaterThan(0);
    expect(rotation.rotationY).toBeGreaterThan(0);
    expect(hasCoinMomentum(velocity)).toBe(true);

    const draggedY = rotation.rotationY;
    releaseCoinMomentum(velocity, 0.02);
    advanceCoinSpin(rotation, velocity, 0.1);
    expect(rotation.rotationY).toBeGreaterThan(draggedY);

    for (let frame = 0; frame < 100; frame += 1) advanceCoinSpin(rotation, velocity, 0.1);
    expect(hasCoinMomentum(velocity)).toBe(false);
  });
});
