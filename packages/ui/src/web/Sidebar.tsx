'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';

export type SidebarProps = {
  children?: React.ReactNode;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
};

export type SidebarSlotProps = {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export type SidebarItemProps = {
  children: React.ReactNode;
  href?: string;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  className?: string;
  style?: React.CSSProperties;
};

type SidebarContextValue = { collapsed: boolean };
const SidebarContext = React.createContext<SidebarContextValue>({ collapsed: false });

export function Sidebar({
  children,
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  label = 'Sidebar navigation',
  className,
  style,
}: SidebarProps) {
  const { tokens } = useTheme();
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = React.useState(defaultCollapsed);
  const isCollapsed = collapsed ?? uncontrolledCollapsed;
  const toggleCollapsed = () => {
    const next = !isCollapsed;
    if (collapsed === undefined) setUncontrolledCollapsed(next);
    onCollapsedChange?.(next);
  };

  return (
    <SidebarContext.Provider value={{ collapsed: isCollapsed }}>
      <aside
        aria-label={label}
        data-collapsed={isCollapsed || undefined}
        className={className}
        style={{
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          width: isCollapsed ? 68 : 256,
          minWidth: isCollapsed ? 68 : 256,
          height: '100%',
          overflow: 'hidden',
          borderRight: `1px solid ${tokens.border}`,
          background: tokens.surfaceSubtle,
          color: tokens.foreground,
          transition: 'width 160ms ease, min-width 160ms ease',
          ...style,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: isCollapsed ? 'center' : 'flex-end',
            padding: 8,
          }}
        >
          <button
            type="button"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
            onClick={toggleCollapsed}
            style={{
              border: `1px solid ${tokens.border}`,
              borderRadius: 8,
              background: 'transparent',
              color: tokens.foregroundMuted,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            {isCollapsed ? '›' : '‹'}
          </button>
        </div>
        <nav
          aria-label={label}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          {children}
        </nav>
      </aside>
    </SidebarContext.Provider>
  );
}

export function SidebarHeader({ children, className, style }: SidebarSlotProps) {
  const { tokens } = useTheme();
  return (
    <div
      className={className}
      style={{ padding: '12px 16px', color: tokens.foregroundStrong, fontWeight: 700, ...style }}
    >
      {children}
    </div>
  );
}

export function SidebarContent({ children, className, style }: SidebarSlotProps) {
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px', ...style }}
    >
      {children}
    </div>
  );
}

export function SidebarFooter({ children, className, style }: SidebarSlotProps) {
  const { tokens } = useTheme();
  return (
    <div
      className={className}
      style={{
        marginTop: 'auto',
        padding: 12,
        borderTop: `1px solid ${tokens.borderSubtle}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SidebarItem({
  children,
  href,
  icon,
  active = false,
  disabled = false,
  onClick,
  className,
  style,
}: SidebarItemProps) {
  const { tokens } = useTheme();
  const { collapsed } = React.useContext(SidebarContext);
  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minHeight: 42,
    boxSizing: 'border-box',
    justifyContent: collapsed ? 'center' : 'flex-start',
    padding: collapsed ? '8px' : '8px 12px',
    borderRadius: 9,
    color: active ? tokens.primary : tokens.foregroundMuted,
    background: active ? tokens.surfaceRaised : 'transparent',
    textDecoration: 'none',
    font: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    ...style,
  };
  const content = (
    <>
      {icon ? (
        <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0 }}>
          {icon}
        </span>
      ) : null}
      <span
        style={
          collapsed
            ? {
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: 0,
              }
            : undefined
        }
      >
        {children}
      </span>
    </>
  );
  if (href)
    return (
      <a
        href={disabled ? undefined : href}
        aria-current={active ? 'page' : undefined}
        aria-disabled={disabled || undefined}
        title={collapsed && typeof children === 'string' ? children : undefined}
        className={className}
        onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>}
        style={itemStyle}
      >
        {content}
      </a>
    );
  return (
    <button
      type="button"
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      title={collapsed && typeof children === 'string' ? children : undefined}
      className={className}
      onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
      style={itemStyle}
    >
      {content}
    </button>
  );
}
