import React, { useState } from 'react';
import { Tabs, router } from 'expo-router';
import { ClockCounterClockwise, House, Plus, UserCircle, UsersThree } from '@/lib/icons';
import { Button, Sheet } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { quickAddActions } from '@/lib/navigation/quick-add';

export default function TabsLayout() {
  const [open, setOpen] = useState(false);
  const { tokens } = useTheme();
  const iconProps = { size: 21, weight: 'regular' as const };
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: tokens.primary,
          tabBarInactiveTintColor: tokens.mutedForeground,
          tabBarStyle: {
            backgroundColor: tokens.background,
            borderTopColor: tokens.borderSubtle,
            borderTopWidth: 1,
            height: 76,
            paddingTop: 8,
            paddingBottom: 10,
          },
          tabBarLabelStyle: {
            fontFamily: 'PlusJakartaSans_600SemiBold',
            fontSize: 10,
            marginTop: 2,
          },
          tabBarItemStyle: { minHeight: 52 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: ({ color }) => <House {...iconProps} color={color as string} /> }} />
        <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: ({ color }) => <ClockCounterClockwise {...iconProps} color={color as string} /> }} />
        <Tabs.Screen
          name="add"
          options={{
            title: '',
            tabBarLabel: () => null,
            tabBarButton: () => (
              <Button accessibilityLabel="Add transaction" size="icon" style={{ alignSelf: 'center', marginTop: -7 }} onPress={() => setOpen(true)}>
                <Plus size={22} weight="bold" color={tokens.primaryForeground} />
              </Button>
            ),
          }}
        />
        <Tabs.Screen name="groups" options={{ title: 'Groups', tabBarIcon: ({ color }) => <UsersThree {...iconProps} color={color as string} /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <UserCircle {...iconProps} color={color as string} /> }} />
      </Tabs>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Add to Finapp">
        {quickAddActions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            onPress={() => {
              setOpen(false);
              router.push(action.route as never);
            }}
          >
            {action.label}
          </Button>
        ))}
      </Sheet>
    </>
  );
}
