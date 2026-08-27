import React, { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Slot, router, usePathname } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ClockCounterClockwise, House, Plus, UserCircle, UsersThree } from '@/lib/icons';
import { Button, Separator, Sheet, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { quickAddActions } from '@/lib/navigation/quick-add';

const navItems = [
  { label: 'Home', route: '/(tabs)', match: '/(tabs)', icon: House },
  { label: 'Activity', route: '/(tabs)/activity', match: '/activity', icon: ClockCounterClockwise },
  { label: 'Groups', route: '/(tabs)/groups', match: '/groups', icon: UsersThree },
  { label: 'Profile', route: '/(tabs)/profile', match: '/profile', icon: UserCircle },
] as const;

const quickAddDescriptions: Record<(typeof quickAddActions)[number]['label'], string> = {
  Expense: 'Money you spent',
  Income: 'Money you received',
  Transfer: 'Move between accounts',
  'Split expense': 'Share with people',
  Settlement: 'Pay someone back',
};

type NavItem = (typeof navItems)[number];

function NavButton({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const { tokens } = useTheme();
  const active = item.match === '/(tabs)' ? pathname === '/' : pathname.includes(item.match);
  const Icon = item.icon;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      onPress={() => router.navigate(item.route as never)}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {active && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            width: 18,
            height: 2,
            borderRadius: 1,
            backgroundColor: tokens.primary,
          }}
        />
      )}
      <Icon size={22} color={active ? tokens.foreground : tokens.foregroundSubtle} />
      <Text
        style={{
          color: active ? tokens.foreground : tokens.foregroundSubtle,
          fontFamily: 'SpaceGrotesk_500Medium',
          fontSize: 10,
          lineHeight: 13,
        }}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

function AddButton({ onPress }: { onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        zIndex: 20,
        elevation: 20,
      }}
    >
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: '#B7FF4A',
          zIndex: 21,
          elevation: 21,
          shadowColor: tokens.primary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.22,
          shadowRadius: 18,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add"
          onPress={onPress}
          style={({ pressed }) => ({
            flex: 1,
            borderRadius: 29,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.96 : 1 }],
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <Plus size={25} strokeWidth={2.2} color={tokens.primaryForeground} />
        </Pressable>
      </View>
    </View>
  );
}

function SignatureBottomBar({ onAdd }: { onAdd: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const center = width / 2;
  const height = 96 + insets.bottom;
  const topLine = 24;
  const valleyBottom = 68;
  const path = [
    `M 0 ${topLine}`,
    `L ${center - 74} ${topLine}`,
    `C ${center - 57} ${topLine} ${center - 59} 52 ${center - 42} 60`,
    `C ${center - 28} 66 ${center - 18} ${valleyBottom} ${center} ${valleyBottom}`,
    `C ${center + 18} ${valleyBottom} ${center + 28} 66 ${center + 42} 60`,
    `C ${center + 59} 52 ${center + 57} ${topLine} ${center + 74} ${topLine}`,
    `L ${width} ${topLine}`,
    `L ${width} ${height}`,
    `L 0 ${height}`,
    'Z',
  ].join(' ');

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}
    >
      <Svg width={width} height={height} style={{ position: 'absolute' }} pointerEvents="none">
        <Path d={path} fill="#080808" stroke={tokens.borderSubtle} strokeWidth={1} />
      </Svg>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 88,
          flexDirection: 'row',
          zIndex: 10,
          elevation: 10,
        }}
      >
        <NavButton item={navItems[0]} />
        <NavButton item={navItems[1]} />
        <AddButton onPress={onAdd} />
        <NavButton item={navItems[2]} />
        <NavButton item={navItems[3]} />
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Slot />
      <SignatureBottomBar onAdd={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Add">
        <View>
          {quickAddActions.map((action, index) => (
            <React.Fragment key={action.label}>
              <Button
                variant="ghost"
                onPress={() => {
                  setOpen(false);
                  router.push(action.route as never);
                }}
                style={{ justifyContent: 'flex-start', minHeight: 68, paddingHorizontal: 4 }}
              >
                <View style={{ gap: 3 }}>
                  <Typography variant="bodyLarge">{action.label}</Typography>
                  <Typography variant="small">{quickAddDescriptions[action.label]}</Typography>
                </View>
              </Button>
              {index < quickAddActions.length - 1 && <Separator />}
            </React.Fragment>
          ))}
        </View>
      </Sheet>
    </>
  );
}
