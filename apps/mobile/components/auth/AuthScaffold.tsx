import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { IconButton, Text, Typography, useTheme } from '@finapp/ui/native';

export function AuthScaffold({
  title,
  eyebrow,
  description,
  children,
  footer,
  hero = false,
  back = true,
  onBack,
  headerRight,
}: {
  title: React.ReactNode;
  eyebrow: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  hero?: boolean;
  back?: boolean;
  onBack?: () => void;
  headerRight?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  const { width, height } = useWindowDimensions();
  const wide = width >= 840;
  const compact = height < 620;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: tokens.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingHorizontal: width < 360 ? 16 : 24 }]}
        >
          <View style={[styles.container, { maxWidth: wide ? 1120 : 520 }]}>
            <View style={styles.header}>
              {back && (
                <IconButton
                  label="Go back"
                  variant="ghost"
                  style={{ backgroundColor: tokens.surfaceRaised, borderRadius: 24 }}
                  onPress={
                    onBack ??
                    (() => (router.canGoBack() ? router.back() : router.replace('/(auth)/welcome')))
                  }
                >
                  <ArrowLeft size={20} color={tokens.foreground} />
                </IconButton>
              )}
              <View style={{ marginLeft: 'auto' }}>{headerRight}</View>
            </View>
            <View
              style={[
                styles.body,
                {
                  flexDirection: wide ? 'row' : 'column',
                  gap: wide ? 64 : 28,
                  paddingVertical: compact ? 24 : 36,
                },
              ]}
            >
              <View style={[styles.story, { flex: wide ? 1 : undefined }]}>
                <View style={{ gap: 14 }}>
                  <Typography variant="caption" style={{ color: tokens.primary, letterSpacing: 2 }}>
                    {eyebrow.toUpperCase()}
                  </Typography>
                  <Typography
                    accessibilityRole="header"
                    style={[
                      styles.title,
                      { fontSize: hero || wide ? 48 : 36, lineHeight: hero || wide ? 52 : 40 },
                    ]}
                  >
                    {title}
                  </Typography>
                  {description && (
                    <Text style={{ color: tokens.foregroundMuted, maxWidth: 420, lineHeight: 24 }}>
                      {description}
                    </Text>
                  )}
                </View>
              </View>
              <View style={[styles.formColumn, { flex: wide ? 1 : undefined }]}>
                {children && (
                  <View
                    style={[
                      styles.form,
                      { backgroundColor: tokens.card, borderColor: tokens.borderSubtle },
                    ]}
                  >
                    {children}
                  </View>
                )}
                {footer && <View style={styles.footer}>{footer}</View>}
              </View>
            </View>
            <Typography variant="caption" style={styles.bottomNote}>
              YOUR MONEY. YOUR PACE.
            </Typography>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingTop: 12, paddingBottom: 24 },
  container: { flexGrow: 1, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  body: { flexGrow: 1, justifyContent: 'center' },
  story: { gap: 20, justifyContent: 'center' },
  title: { fontFamily: 'SpaceGrotesk_600SemiBold', letterSpacing: -1.8 },
  formColumn: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  form: { borderRadius: 28, borderWidth: 1, padding: 20, gap: 20 },
  footer: { gap: 10 },
  bottomNote: { textAlign: 'center', letterSpacing: 1.6, paddingTop: 8 },
});
