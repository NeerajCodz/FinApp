import React from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import { useTheme } from './ThemeProvider';

export type MessageScrollerProps = Omit<ScrollViewProps, 'children' | 'onContentSizeChange'> & {
  children?: React.ReactNode;
  /** Keep the newest messages visible as content is appended. */
  stickToBottom?: boolean;
  /** Accessible name for the scrollable message region. */
  label?: string;
  onContentSizeChange?: ScrollViewProps['onContentSizeChange'];
};

export const MessageScroller = React.forwardRef<ScrollView, MessageScrollerProps>(
  function MessageScroller(
    { children, stickToBottom = true, label = 'Messages', onContentSizeChange, ...props },
    forwardedRef,
  ) {
    const { tokens } = useTheme();
    const localRef = React.useRef<ScrollView>(null);
    const wasAtBottom = React.useRef(true);
    const setRef = React.useCallback(
      (node: ScrollView | null) => {
        localRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    const handleContentSizeChange: NonNullable<ScrollViewProps['onContentSizeChange']> = (
      width,
      height,
    ) => {
      if (stickToBottom && wasAtBottom.current) localRef.current?.scrollToEnd({ animated: false });
      onContentSizeChange?.(width, height);
    };

    return (
      <ScrollView
        {...props}
        ref={setRef}
        accessibilityLabel={label}
        onContentSizeChange={handleContentSizeChange}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          wasAtBottom.current =
            contentSize.height - contentOffset.y - layoutMeasurement.height <= 32;
          props.onScroll?.(event);
        }}
        scrollEventThrottle={props.scrollEventThrottle ?? 16}
        style={[{ flex: 1, backgroundColor: tokens.background }, props.style]}
        contentContainerStyle={[{ flexGrow: 1 }, props.contentContainerStyle]}
      >
        {children}
      </ScrollView>
    );
  },
);

MessageScroller.displayName = 'MessageScroller';
