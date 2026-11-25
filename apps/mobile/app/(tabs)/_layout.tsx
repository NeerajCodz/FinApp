import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Slot, router, usePathname } from 'expo-router';
import { ClockCounterClockwise, House, Plus, User, UsersThree } from '@finapp/ui/icons/native';
import { Button, Separator, Sheet, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { quickAddActions } from '@finapp/ui/quick-add';
import { TAB_BAR_HEIGHT } from '@/lib/tabBar';

const ADD_SIZE = 52;

const navItems = [
  { label: 'Home', route: '/(tabs)', match: '/(tabs)', icon: House },
  { label: 'Activity', route: '/(tabs)/activity', match: '/activity', icon: ClockCounterClockwise },
  { label: 'Groups', route: '/(tabs)/groups', match: '/groups', icon: UsersThree },
  { label: 'People', route: '/(tabs)/people', match: '/people', icon: User },
] as const;

type NavItem = (typeof navItems)[number];

function NavButton({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const { tokens } = useTheme();
  const active = item.match === '/(tabs)' ? pathname === '/' : pathname.includes(item.match);
  const Icon = item.icon;
  const color = active ? tokens.primary : tokens.foregroundSubtle;
  return (
    <TouchableOpacity
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      activeOpacity={0.72}
      onPress={() => router.navigate(item.route as never)}
      style={{
        flex: 1,
        height: TAB_BAR_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
      }}
    >
      <Icon size={22} color={color} weight={active ? 'bold' : 'regular'} />
      <Text
        numberOfLines={1}
        style={{ color, fontFamily: 'SpaceGrotesk_500Medium', fontSize: 11, lineHeight: 14 }}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

/** The + button, seated inside the bar like the tabs (nothing pokes out above it). */
function AddButton({ onPress }: { onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <View style={{ height: TAB_BAR_HEIGHT, paddingHorizontal: 4, justifyContent: 'center' }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Add"
        activeOpacity={0.85}
        onPress={onPress}
        style={{
          width: ADD_SIZE,
          height: ADD_SIZE,
          borderRadius: 18,
          backgroundColor: tokens.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={24} strokeWidth={2.4} color={tokens.primaryForeground} />
      </TouchableOpacity>
    </View>
  );
}

/** A solid bar (nothing shows through it) with four tabs and the + in the middle. */
function BottomBar({ onAdd }: { onAdd: () => void }) {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: insets.bottom,
        backgroundColor: tokens.background,
        borderTopWidth: 1,
        borderTopColor: tokens.borderSubtle,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}>
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
  const insets = useSafeAreaInsets();
  return (
    <>
      <View
        style={{
          flex: 1,
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom,
        }}
      >
        <Slot />
      </View>
      <BottomBar onAdd={() => setOpen(true)} />
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
                  <Typography variant="small">{action.description}</Typography>
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
