import React, { useEffect, useState } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { Button, Text, Typography, useTheme } from '@finapp/ui/native';

const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DateTimePicker({
  value,
  onChange,
  showTime = false,
}: {
  value: number;
  onChange: (timestamp: number) => void;
  showTime?: boolean;
}) {
  const { tokens } = useTheme();
  const selected = new Date(value);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const leading = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: leading + days }, (_, index) =>
    index < leading ? 0 : index - leading + 1,
  );
  const time = `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`;
  const [timeDraft, setTimeDraft] = useState(time);
  useEffect(() => setTimeDraft(time), [time]);

  function chooseDay(day: number) {
    const updated = new Date(value);
    updated.setFullYear(year, month, day);
    onChange(updated.getTime());
  }

  function chooseTime(next: string) {
    const match = /^(\d{2}):(\d{2})$/.exec(next);
    if (!match) return;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return;
    const updated = new Date(value);
    updated.setHours(hour, minute, 0, 0);
    onChange(updated.getTime());
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          variant="outline"
          size="sm"
          accessibilityLabel="Previous month"
          onPress={() => setVisibleMonth(new Date(year, month - 1, 1))}
        >
          ‹
        </Button>
        <Typography variant="bodyLarge">
          {visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Typography>
        <Button
          variant="outline"
          size="sm"
          accessibilityLabel="Next month"
          onPress={() => setVisibleMonth(new Date(year, month + 1, 1))}
        >
          ›
        </Button>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {weekdays.map((day) => (
          <Typography
            key={day}
            variant="caption"
            style={{ width: '14.2857%', textAlign: 'center' }}
          >
            {day}
          </Typography>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, index) => {
          const isSelected =
            day > 0 &&
            selected.getFullYear() === year &&
            selected.getMonth() === month &&
            selected.getDate() === day;
          return (
            <View key={index} style={{ width: '14.2857%', padding: 2 }}>
              {day > 0 && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={new Date(year, month, day).toLocaleDateString(undefined, {
                    dateStyle: 'full',
                  })}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => chooseDay(day)}
                  style={{
                    height: 42,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    backgroundColor: isSelected ? tokens.primary : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? tokens.primaryForeground : tokens.foreground,
                      fontFamily: 'SpaceGrotesk_500Medium',
                    }}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
      {showTime && (
        <View style={{ gap: 6 }}>
          <Typography variant="label">Time</Typography>
          <TextInput
            accessibilityLabel="Transaction time"
            value={timeDraft}
            onChangeText={(next) => {
              setTimeDraft(next);
              chooseTime(next);
            }}
            keyboardType="numbers-and-punctuation"
            placeholder="HH:MM"
            maxLength={5}
            style={{
              minHeight: 44,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              borderRadius: 10,
              paddingHorizontal: 12,
              color: tokens.foreground,
              fontFamily: 'SpaceGrotesk_500Medium',
            }}
          />
        </View>
      )}
      <Button
        variant="outline"
        onPress={() => {
          const today = new Date();
          if (!showTime) today.setHours(12, 0, 0, 0);
          setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
          onChange(today.getTime());
        }}
      >
        {showTime ? 'Today · Now' : 'Today'}
      </Button>
    </View>
  );
}
