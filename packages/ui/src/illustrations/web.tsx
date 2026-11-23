import React from 'react';
import {
  illustrationCssPalette,
  illustrationScenes,
  illustrationViewBox,
  type IllustrationRole,
  type IllustrationScene,
  type IllustrationShape,
} from './scenes';

export type IllustrationProps = {
  scene: IllustrationScene;
  /** Rendered width in px; height follows the 192×132 aspect ratio. */
  size?: number;
  backdrop?: boolean;
  className?: string;
};

/**
 * Decorative, theme-driven illustration. Colours are CSS variables from the theme provider, so
 * server and client markup match and the art follows light/dark and accent changes.
 */
export function Illustration({ scene, size = 156, backdrop = true, className }: IllustrationProps) {
  const paint = (role?: IllustrationRole) => (role ? illustrationCssPalette[role] : undefined);
  const shapes: readonly IllustrationShape[] = illustrationScenes[scene];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      width={size}
      height={(size * 132) / 192}
      viewBox={illustrationViewBox}
    >
      {backdrop ? <circle cx={96} cy={66} r={56} fill={illustrationCssPalette.surface} /> : null}
      {shapes.map((shape, index) => {
        if (shape.type === 'circle') {
          const { type: _type, fill, stroke, ...rest } = shape;
          return (
            <circle key={index} {...rest} fill={paint(fill) ?? 'none'} stroke={paint(stroke)} />
          );
        }
        if (shape.type === 'rect') {
          const { type: _type, fill, stroke, ...rest } = shape;
          return <rect key={index} {...rest} fill={paint(fill) ?? 'none'} stroke={paint(stroke)} />;
        }
        const { type: _type, fill, stroke, ...rest } = shape;
        return <path key={index} {...rest} fill={paint(fill) ?? 'none'} stroke={paint(stroke)} />;
      })}
    </svg>
  );
}

export { illustrationScenes, type IllustrationScene } from './scenes';
