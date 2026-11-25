/**
 * The full-screen app lock (native): brand, the signed-in person (avatar in the accent ring,
 * name, @username), a status line and the unlock methods. Theme tokens only, so it follows
 * light/dark and custom accents.
 */
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LockKeyhole } from 'lucide-react-native';
import { Avatar } from '../../native/feedback';
import { useTheme } from '../../native/ThemeProvider';
import { fontFamilies } from '../../tokens';
import { FinanceBrand } from './FinanceBrand';

export type LockScreenPerson = {
  name: string;
  username?: string;
  initials: string;
  imageUrl?: string | null;
  avatarId?: string;
};

export function LockScreen({
  person,
  title = 'Finapp is locked',
  subtitle,
  children,
  onSignOut,
}: {
  person: LockScreenPerson;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  onSignOut?: () => void;
}) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 20,
        paddingHorizontal: 20,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ alignItems: 'center' }}>
        <FinanceBrand />
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: 22, paddingVertical: 24 }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <View
            style={{
              padding: 4,
              marginBottom: 8,
              borderRadius: 999,
              borderWidth: 3,
              borderColor: tokens.primary,
              shadowColor: tokens.primary,
              shadowOpacity: 0.35,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 8,
              backgroundColor: tokens.background,
            }}
          >
            <Avatar
              initials={person.initials}
              label={person.name}
              size={88}
              imageUrl={person.imageUrl}
              {...(person.avatarId ? { avatarId: person.avatarId } : {})}
            />
            <View
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 30,
                height: 30,
                borderRadius: 15,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 3,
                borderColor: tokens.background,
                backgroundColor: tokens.primary,
              }}
            >
              <LockKeyhole size={14} strokeWidth={2.4} color={tokens.primaryForeground} />
            </View>
          </View>
          <Text
            style={{
              color: tokens.foreground,
              fontFamily: fontFamilies.brand.bold,
              fontSize: 24,
            }}
          >
            {person.name}
          </Text>
          {person.username ? (
            <Text style={{ color: tokens.foregroundMuted, fontSize: 14 }}>@{person.username}</Text>
          ) : null}
        </View>
        <View
          style={{
            gap: 14,
            padding: 20,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            backgroundColor: tokens.card,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              color: tokens.foreground,
              fontFamily: fontFamilies.brand.bold,
              fontSize: 18,
              textAlign: 'center',
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                marginTop: -6,
                color: tokens.foregroundMuted,
                fontSize: 13,
                lineHeight: 18,
                textAlign: 'center',
              }}
            >
              {subtitle}
            </Text>
          ) : null}
          <View style={{ gap: 10 }}>{children}</View>
        </View>
      </View>
      {onSignOut ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <Text style={{ color: tokens.foregroundMuted, fontSize: 13 }}>
            Not {person.name.split(' ')[0]}?
          </Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onSignOut}>
            <Text style={{ color: tokens.primary, fontSize: 13, fontWeight: '700' }}>Sign out</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}
