import React from 'react';
import { Text as RNText, View } from 'react-native';
import { createTokens, type ThemeTokens } from '@finapp/ui/tokens';
import { useTheme } from '@finapp/ui/native';

type FallbackProps = {
  error: Error;
  retry: () => void;
  tokens: ThemeTokens;
};

export function ErrorFallbackView({ error, retry, tokens }: FallbackProps) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        flex: 1,
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        backgroundColor: tokens.background,
      }}
    >
      <RNText
        style={{
          color: tokens.foreground,
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 24,
          lineHeight: 29,
        }}
      >
        Something went wrong here.
      </RNText>
      <RNText style={{ color: tokens.mutedForeground, maxWidth: 320 }}>
        Your saved financial data is safe. Try again, or go back and reopen this screen.
      </RNText>
      {__DEV__ ? (
        <RNText selectable style={{ color: tokens.mutedForeground, fontSize: 12 }}>
          {error.message}
        </RNText>
      ) : null}
      <RNText
        accessibilityRole="button"
        onPress={retry}
        style={{
          alignSelf: 'flex-start',
          marginTop: 8,
          overflow: 'hidden',
          borderRadius: 14,
          paddingHorizontal: 18,
          paddingVertical: 12,
          color: tokens.primaryForeground,
          backgroundColor: tokens.primary,
          fontFamily: 'SpaceGrotesk_600SemiBold',
        }}
      >
        Try again
      </RNText>
    </View>
  );
}

/** Route-level fallback, rendered inside the theme provider. */
export function ThemedErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  const { tokens } = useTheme();
  return <ErrorFallbackView error={error} retry={retry} tokens={tokens} />;
}

/** Last-resort fallback for errors thrown outside the theme provider. */
export function StaticErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  return <ErrorFallbackView error={error} retry={retry} tokens={createTokens('dark')} />;
}

type BoundaryState = { error: Error | null };

/** Catches render errors below the providers so one broken screen cannot take down the app. */
export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (this.state.error)
      return <ThemedErrorFallback error={this.state.error} retry={this.retry} />;
    return this.props.children;
  }
}
