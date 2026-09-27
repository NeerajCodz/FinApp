import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button } from './button';

export const ScrollArea = ({ children, ...props }: React.ComponentProps<typeof ScrollView>) => (
  <ScrollView {...props}>{children}</ScrollView>
);

export const Accordion = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Collapsible title={title}>{children}</Collapsible>
);

export const Collapsible = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Button variant="ghost" onPress={() => setOpen(!open)}>
        {title}
      </Button>
      {open && children}
    </View>
  );
};
