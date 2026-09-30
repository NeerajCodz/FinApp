'use client';

import React from 'react';

export type ButtonGroupOrientation = 'horizontal' | 'vertical';

export type ButtonGroupProps = {
  children: React.ReactNode;
  label: string;
  orientation?: ButtonGroupOrientation;
  className?: string;
  style?: React.CSSProperties;
};

export function ButtonGroup({
  children,
  label,
  orientation = 'horizontal',
  className,
  style,
}: ButtonGroupProps) {
  const items = React.Children.toArray(children);
  const horizontal = orientation === 'horizontal';
  return (
    <div
      role="group"
      aria-label={label}
      aria-orientation={orientation}
      className={className}
      style={{
        display: 'inline-flex',
        flexDirection: horizontal ? 'row' : 'column',
        alignItems: 'stretch',
        ...style,
      }}
    >
      {items.map((child, index) => {
        if (!React.isValidElement<{ style?: React.CSSProperties }>(child)) {
          return <React.Fragment key={index}>{child}</React.Fragment>;
        }
        const first = index === 0;
        const last = index === items.length - 1;
        const radius = horizontal
          ? `${first ? 12 : 0}px ${last ? 12 : 0}px ${last ? 12 : 0}px ${first ? 12 : 0}px`
          : `${first ? 12 : 0}px ${first ? 12 : 0}px ${last ? 12 : 0}px ${last ? 12 : 0}px`;
        return React.cloneElement(child, {
          key: child.key ?? index,
          style: {
            ...child.props.style,
            borderRadius: radius,
            borderColor: 'var(--finapp-border)',
            ...(index > 0 ? (horizontal ? { marginLeft: -1 } : { marginTop: -1 }) : {}),
            position: 'relative',
          },
        });
      })}
    </div>
  );
}
