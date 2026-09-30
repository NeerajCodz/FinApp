import { animate } from 'animejs';

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
