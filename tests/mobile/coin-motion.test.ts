import { describe, expect, it } from 'vitest';
import { createCoinFloat } from '../../packages/ui/src/coin/motion';

describe('coin float', () => {
  it('loads without browser globals and preserves the float cycle', () => {
    const motion = createCoinFloat();

    expect(motion.sample(0)).toBeCloseTo(-0.035);
    expect(motion.sample(1.6)).toBeCloseTo(0);
    expect(motion.sample(3.2)).toBeCloseTo(0.035);
    expect(motion.sample(4.8)).toBeCloseTo(0);
    expect(motion.sample(6.4)).toBeCloseTo(-0.035);
  });
});
