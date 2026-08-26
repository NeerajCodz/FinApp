import React, { useState } from 'react';
import { Tabs, router } from 'expo-router';
import { Button, Sheet } from '@/components/ui';
import { quickAddActions } from '@/lib/navigation/quick-add';

export default function TabsLayout() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#315CFF' }}>
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
        <Tabs.Screen
          name="add"
          options={{
            title: '',
            tabBarButton: () => (
              <Button accessibilityLabel="Add transaction" onPress={() => setOpen(true)}>
                +
              </Button>
            ),
          }}
        />
        <Tabs.Screen name="groups" options={{ title: 'Groups' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Add to Finapp">
        {quickAddActions.map((action) => (
          <Button
            key={action.label}
            variant="secondary"
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
