'use client';

import React from 'react';

export type ResizableOrientation = 'horizontal' | 'vertical';
export type ResizableProps = {
  children: readonly [React.ReactNode, React.ReactNode];
  orientation?: ResizableOrientation;
  initialSize?: number;
  minSize?: number;
  maxSize?: number;
  step?: number;
  accessibilityLabel?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function Resizable({
  children,
  orientation = 'horizontal',
  initialSize = 50,
  minSize = 15,
  maxSize = 85,
  step = 3,
  accessibilityLabel = 'Resize panels',
  className,
  style,
}: ResizableProps) {
  const [size, setSize] = React.useState(Math.min(maxSize, Math.max(minSize, initialSize)));
  const root = React.useRef<HTMLDivElement>(null);
  const horizontal = orientation === 'horizontal';
  const setFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = root.current?.getBoundingClientRect();
    if (!rect) return;
    const next = horizontal
      ? ((event.clientX - rect.left) / rect.width) * 100
      : ((event.clientY - rect.top) / rect.height) * 100;
    setSize(Math.min(maxSize, Math.max(minSize, next)));
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const forward = horizontal ? ['ArrowRight', 'ArrowDown'] : ['ArrowDown', 'ArrowRight'];
    const backward = horizontal ? ['ArrowLeft', 'ArrowUp'] : ['ArrowUp', 'ArrowLeft'];
    if (
      !forward.includes(event.key) &&
      !backward.includes(event.key) &&
      event.key !== 'Home' &&
      event.key !== 'End'
    )
      return;
    event.preventDefault();
    setSize((current) =>
      event.key === 'Home'
        ? minSize
        : event.key === 'End'
          ? maxSize
          : Math.min(
              maxSize,
              Math.max(minSize, current + (forward.includes(event.key) ? step : -step)),
            ),
    );
  };
  return (
    <div
      ref={root}
      className={className}
      style={{
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        minWidth: 0,
        minHeight: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          [horizontal ? 'width' : 'height']: `${size}%`,
          minWidth: horizontal ? 0 : undefined,
          minHeight: horizontal ? undefined : 0,
          flexShrink: 0,
          overflow: 'auto',
        }}
      >
        {children[0]}
      </div>
      <div
        role="separator"
        tabIndex={0}
        aria-label={accessibilityLabel}
        aria-orientation={horizontal ? 'vertical' : 'horizontal'}
        aria-valuemin={minSize}
        aria-valuemax={maxSize}
        aria-valuenow={Math.round(size)}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 0) setFromPointer(event);
        }}
        style={{
          position: 'relative',
          flex: '0 0 auto',
          [horizontal ? 'width' : 'height']: 12,
          cursor: horizontal ? 'col-resize' : 'row-resize',
          touchAction: 'none',
          display: 'grid',
          placeItems: 'center',
          outlineColor: 'var(--finapp-ring)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            [horizontal ? 'width' : 'height']: 2,
            [horizontal ? 'height' : 'width']: '40%',
            minHeight: horizontal ? 24 : undefined,
            minWidth: horizontal ? undefined : 24,
            borderRadius: 2,
            background: 'var(--finapp-border)',
          }}
        />
      </div>
      <div
        style={{
          flex: '1 1 0',
          minWidth: horizontal ? 0 : undefined,
          minHeight: horizontal ? undefined : 0,
          overflow: 'auto',
        }}
      >
        {children[1]}
      </div>
    </div>
  );
}
