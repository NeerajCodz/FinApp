import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@finapp/ui/native';

export function FinanceBrand() {
  const { tokens } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel="Finapp"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <View
        accessible={false}
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: '#B7FF4A',
        }}
      />
      <Text
        style={{
          color: tokens.foreground,
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 15,
          lineHeight: 20,
          letterSpacing: -0.5,
        }}
      >
        finapp
      </Text>
    </View>
  );
}
