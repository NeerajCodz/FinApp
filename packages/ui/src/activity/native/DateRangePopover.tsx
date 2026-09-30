import React, { useMemo, useState } from 'react';
import { Modal, Pressable, TouchableOpacity, View } from 'react-native';
import { CalendarDays, CaretRight } from '@finapp/ui/icons/native';
import { Typography, useTheme } from '@finapp/ui/native';
import {
  calendarMonthDays,
  calendarMonthKey,
  defaultDateRangePresets,
  formatCalendarDate,
  getDateRangePreset,
  localCalendarDateKey,
  shiftCalendarMonth,
} from '../dateRangeCalendar';
import type { DateRangePreset } from '../dateRangeCalendar';

export function DateRangePopover({
  label,
  startDate,
  endDate,
  presets,
  onPresetSelect,
  onRangeApply,
}: {
  label: string;
  startDate: string;
  endDate: string;
  presets: readonly DateRangePreset[];
  onPresetSelect: (value: string) => void;
  onRangeApply: (startDate: string, endDate: string) => void;
}) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() =>
    calendarMonthKey(startDate || localCalendarDateKey(new Date())),
  );
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const days = useMemo(() => calendarMonthDays(month), [month]);
  const [year = 1970, monthNumber = 1] = month.split('-').map(Number);
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  const quickPresets = useMemo(
    () => [
      ...defaultDateRangePresets,
      ...presets.filter(
        (preset) =>
          !defaultDateRangePresets.some((defaultPreset) => defaultPreset.label === preset.label),
      ),
    ],
    [presets],
  );
  const chooseDay = (date: string) => {
    if (!draftStart || draftEnd) {
      setDraftStart(date);
      setDraftEnd('');
    } else if (date < draftStart) {
      setDraftStart(date);
      setDraftEnd('');
    } else {
      setDraftEnd(date);
    }
  };
  const close = () => setOpen(false);

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Date range: ${label}. Change date range`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setDraftStart(startDate);
          setDraftEnd(endDate);
          setMonth(calendarMonthKey(startDate || localCalendarDateKey(new Date())));
          setOpen(true);
        }}
        style={{
          minHeight: 36,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          paddingHorizontal: 8,
        }}
      >
        <CalendarDays size={15} color={tokens.foregroundMuted} />
        <Typography variant="small" numberOfLines={1}>
          {label}
        </Typography>
        <CaretRight size={13} color={tokens.foregroundMuted} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Pressable
            onPress={close}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: '#0009',
            }}
          />
          <View
            accessibilityLabel="Choose activity date range"
            accessibilityViewIsModal
            style={{
              width: '100%',
              maxWidth: 440,
              maxHeight: '90%',
              gap: 14,
              padding: 18,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceRaised,
              elevation: 12,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="heading">Date range</Typography>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close date picker"
                onPress={close}
              >
                <Typography variant="bodyLarge">×</Typography>
              </TouchableOpacity>
            </View>
            <View style={{ gap: 7 }}>
              <Typography variant="caption">QUICK RANGES</Typography>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {quickPresets.map((preset) => (
                  <TouchableOpacity
                    key={preset.value}
                    accessibilityRole="button"
                    onPress={() => {
                      const providedPreset = presets.find((item) => item.label === preset.label);
                      const range = providedPreset ? undefined : getDateRangePreset(preset.value);
                      if (providedPreset) onPresetSelect(providedPreset.value);
                      else if (range) onRangeApply(range.startDate, range.endDate);
                      else onPresetSelect(preset.value);
                      close();
                    }}
                    style={{
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: tokens.borderSubtle,
                      paddingHorizontal: 11,
                      paddingVertical: 7,
                    }}
                  >
                    <Typography variant="caption">{preset.label}</Typography>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                onPress={() => setMonth((value) => shiftCalendarMonth(value, -1))}
              >
                <Typography variant="bodyLarge">‹</Typography>
              </TouchableOpacity>
              <Typography variant="bodyLarge">{monthLabel}</Typography>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Next month"
                onPress={() => setMonth((value) => shiftCalendarMonth(value, 1))}
              >
                <Typography variant="bodyLarge">›</Typography>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row' }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <View
                  key={day}
                  style={{ width: '14.2857%', alignItems: 'center', paddingVertical: 5 }}
                >
                  <Typography variant="caption">{day}</Typography>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {days.map((date, index) => {
                if (!date)
                  return (
                    <View key={`empty-${index}`} style={{ width: '14.2857%', aspectRatio: 1 }} />
                  );
                const selected = date === draftStart || date === draftEnd;
                const inRange = !!draftStart && !!draftEnd && date > draftStart && date < draftEnd;
                return (
                  <TouchableOpacity
                    key={date}
                    accessibilityRole="button"
                    accessibilityLabel={formatCalendarDate(date)}
                    accessibilityState={{ selected }}
                    onPress={() => chooseDay(date)}
                    style={{
                      width: '14.2857%',
                      aspectRatio: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: selected ? 99 : inRange ? 0 : 99,
                      backgroundColor: selected
                        ? tokens.primary
                        : inRange
                          ? tokens.surfaceSubtle
                          : 'transparent',
                    }}
                  >
                    <Typography
                      variant="small"
                      style={{ color: selected ? tokens.primaryForeground : tokens.foreground }}
                    >
                      {Number(date.slice(-2))}
                    </Typography>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Typography variant="caption">
              {draftStart
                ? `${formatCalendarDate(draftStart)}${draftEnd ? ` – ${formatCalendarDate(draftEnd)}` : ' – Choose an end date or apply this day'}`
                : 'Choose a date range'}
            </Typography>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={close}
                style={{ paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <Typography variant="small">Cancel</Typography>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ disabled: !draftStart }}
                disabled={!draftStart}
                onPress={() => {
                  if (!draftStart) return;
                  onRangeApply(draftStart, draftEnd || draftStart);
                  close();
                }}
                style={{
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: !draftStart ? tokens.surfaceSubtle : tokens.primary,
                }}
              >
                <Typography
                  variant="small"
                  style={{
                    color: !draftStart ? tokens.foregroundMuted : tokens.primaryForeground,
                  }}
                >
                  {draftEnd ? 'Apply range' : 'Apply this day'}
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
