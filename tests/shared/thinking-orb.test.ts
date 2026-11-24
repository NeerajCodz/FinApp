import { describe, expect, it } from 'vitest';
import { createOrbModel, thinkingOrbStates } from '../../packages/ui/src/ai/orbModel';

describe('thinking orb model', () => {
  it.each(thinkingOrbStates)('%s draws every dot inside the orb with valid opacity', (state) => {
    const model = createOrbModel(state, 40);
    expect(model.count).toBe(160);
    for (const t of [0, 250, 1234, 5000, 12_345]) {
      const dots = model.frame(t);
      expect(dots).toHaveLength(160);
      for (const dot of dots) {
        expect(dot.x).toBeGreaterThan(-4);
        expect(dot.x).toBeLessThan(44);
        expect(dot.y).toBeGreaterThan(-4);
        expect(dot.y).toBeLessThan(44);
        expect(dot.r).toBeGreaterThanOrEqual(0.45);
        expect(dot.a).toBeGreaterThanOrEqual(0);
        expect(dot.a).toBeLessThanOrEqual(1);
      }
    }
  });

  it('moves over time and lights a walk while reasoning', () => {
    const model = createOrbModel('reasoning', 20);
    const first = model.frame(0);
    const later = model.frame(1500);
    expect(later.some((dot, index) => Math.abs(dot.x - first[index]!.x) > 0.01)).toBe(true);
    // The sphere rests at half opacity; the walk's dots reach past it.
    expect(Math.max(...later.map((dot) => dot.a))).toBeGreaterThan(0.6);
    // A clock that loops back still animates.
    expect(() => model.frame(100)).not.toThrow();
  });
});
