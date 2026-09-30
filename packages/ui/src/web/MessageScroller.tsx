'use client';

import React from 'react';

export type MessageScrollerProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: React.ReactNode;
  /** Keep the newest messages visible as content is appended. */
  stickToBottom?: boolean;
  /** Accessible name for the scrollable message region. */
  label?: string;
};

export const MessageScroller = React.forwardRef<HTMLDivElement, MessageScrollerProps>(
  function MessageScroller(
    { children, stickToBottom = true, label = 'Messages', onScroll, ...props },
    forwardedRef,
  ) {
    const localRef = React.useRef<HTMLDivElement>(null);
    const wasAtBottom = React.useRef(true);
    const setRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        localRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      wasAtBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight <= 32;
      onScroll?.(event);
    };

    React.useLayoutEffect(() => {
      const element = localRef.current;
      if (element && stickToBottom && wasAtBottom.current) element.scrollTop = element.scrollHeight;
    }, [children, stickToBottom]);

    return (
      <div
        {...props}
        ref={setRef}
        role="log"
        aria-label={label}
        aria-live="polite"
        aria-relevant="additions text"
        onScroll={handleScroll}
        style={{
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          minHeight: 0,
          color: 'var(--finapp-foreground, #f5f5f5)',
          background: 'var(--finapp-surface, #151515)',
          ...props.style,
        }}
      >
        {children}
      </div>
    );
  },
);

MessageScroller.displayName = 'MessageScroller';
