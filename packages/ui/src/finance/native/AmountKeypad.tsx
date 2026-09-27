import React from 'react';
import { View } from 'react-native';
import { Button } from '@finapp/ui/native';

export function AmountKeypad({ onDigit }: { onDigit: (digit: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {'1234567890.'.split('').map((digit) => (
        <Button
          key={digit}
          size="lg"
          variant="ghost"
          onPress={() => onDigit(digit)}
          style={{ width: '30%' }}
        >
          {digit}
        </Button>
      ))}
    </View>
  );
}
