'use client';

import React, { useState } from 'react';

export type CarouselProps = {
  children: React.ReactNode;
  initialIndex?: number;
  index?: number;
  onIndexChange?: (index: number) => void;
  loop?: boolean;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
};

function normalizeIndex(index: number, count: number): number {
  if (count === 0 || !Number.isFinite(index)) return 0;
  return Math.min(count - 1, Math.max(0, Math.floor(index)));
}

export function Carousel({
  children,
  initialIndex = 0,
  index,
  onIndexChange,
  loop = false,
  className,
  style,
  label = 'Carousel',
}: CarouselProps) {
  const items = React.Children.toArray(children);
  const [uncontrolledIndex, setUncontrolledIndex] = useState(() =>
    normalizeIndex(initialIndex, items.length),
  );
  const currentIndex = normalizeIndex(
    index === undefined ? uncontrolledIndex : index,
    items.length,
  );
  const count = items.length;

  const move = (direction: -1 | 1) => {
    if (!count) return;
    const nextIndex = currentIndex + direction;
    const destination = loop ? (nextIndex + count) % count : normalizeIndex(nextIndex, count);
    if (destination === currentIndex) return;
    if (index === undefined) setUncontrolledIndex(destination);
    onIndexChange?.(destination);
  };

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={className}
      style={{ color: 'var(--finapp-foreground, #f5f5f5)', ...style }}
    >
      {count > 0 ? (
        <div
          role="group"
          aria-roledescription="slide"
          aria-label={`${currentIndex + 1} of ${count}`}
        >
          {items[currentIndex]}
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginTop: '0.75rem',
        }}
      >
        <button
          type="button"
          aria-label="Previous slide"
          onClick={() => move(-1)}
          disabled={count === 0 || (!loop && currentIndex === 0)}
          style={controlStyle}
        >
          Previous
        </button>
        <span
          aria-live="polite"
          aria-atomic="true"
          style={{ color: 'var(--finapp-foreground-muted, #999)', fontSize: '0.8rem' }}
        >
          {count ? `${currentIndex + 1} / ${count}` : '0 / 0'}
        </span>
        <button
          type="button"
          aria-label="Next slide"
          onClick={() => move(1)}
          disabled={count === 0 || (!loop && currentIndex === count - 1)}
          style={controlStyle}
        >
          Next
        </button>
      </div>
    </section>
  );
}

const controlStyle: React.CSSProperties = {
  minHeight: 40,
  padding: '0.4rem 0.75rem',
  border: '1px solid var(--finapp-border, rgba(255,255,255,.18))',
  borderRadius: '0.65rem',
  color: 'var(--finapp-foreground, #f5f5f5)',
  background: 'var(--finapp-surface-raised, #202020)',
  font: 'inherit',
  cursor: 'pointer',
};
