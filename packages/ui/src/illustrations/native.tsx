import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../native/ThemeProvider';
import { withAlpha } from '../tokens';
import {
  illustrationPalette,
  illustrationScenes,
  illustrationViewBox,
  type IllustrationRole,
  type IllustrationScene,
  type IllustrationShape,
} from './scenes';

export type IllustrationProps = {
  scene: IllustrationScene;
  /** Rendered width; height follows the 192×132 aspect ratio. */
  size?: number;
  /** Draws the soft backdrop disc behind the scene. */
  backdrop?: boolean;
};

/** Decorative, theme-driven illustration. Colours always come from the active theme. */
export function Illustration({ scene, size = 156, backdrop = true }: IllustrationProps) {
  const { tokens } = useTheme();
  const palette = React.useMemo(() => illustrationPalette(tokens, withAlpha), [tokens]);
  const paint = (role?: IllustrationRole) => (role ? palette[role] : undefined);
  const shapes: readonly IllustrationShape[] = illustrationScenes[scene];
  return (
    <Svg
      width={size}
      height={(size * 132) / 192}
      viewBox={illustrationViewBox}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {backdrop ? <Circle cx={96} cy={66} r={56} fill={palette.surface} /> : null}
      {shapes.map((shape, index) => {
        if (shape.type === 'circle') {
          const { type: _type, fill, stroke, ...rest } = shape;
          return (
            <Circle key={index} {...rest} fill={paint(fill) ?? 'none'} stroke={paint(stroke)} />
          );
        }
        if (shape.type === 'rect') {
          const { type: _type, fill, stroke, ...rest } = shape;
          return <Rect key={index} {...rest} fill={paint(fill) ?? 'none'} stroke={paint(stroke)} />;
        }
        const { type: _type, fill, stroke, ...rest } = shape;
        return <Path key={index} {...rest} fill={paint(fill) ?? 'none'} stroke={paint(stroke)} />;
      })}
    </Svg>
  );
}

export { illustrationScenes, type IllustrationScene } from './scenes';
