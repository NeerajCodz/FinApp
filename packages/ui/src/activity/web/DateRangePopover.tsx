'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog } from '../../web/overlay';
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
export type { DateRangePreset } from '../dateRangeCalendar';

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
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() =>
    calendarMonthKey(startDate || localCalendarDateKey(new Date())),
  );
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
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
  const days = useMemo(() => calendarMonthDays(month), [month]);
  const monthLabel = useMemo(() => {
    const [year = 1970, monthNumber = 1] = month.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  }, [month]);

  useEffect(() => {
    if (!open) return;
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setMonth(calendarMonthKey(startDate || localCalendarDateKey(new Date())));
  }, [endDate, open, startDate]);

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
  const rangeLabel = draftStart
    ? `${formatCalendarDate(draftStart)}${draftEnd ? ` – ${formatCalendarDate(draftEnd)}` : ' – Choose an end date or apply this day'}`
    : 'Choose a date range';

  return (
    <div className="finapp-filter-option-popover activity-date-range">
      <button
        type="button"
        className="activity-date-range__trigger"
        aria-label={`Date range: ${label}. Change date range`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CalendarDays size={15} aria-hidden="true" />
        <span>{label}</span>
      </button>
      <Dialog
        visible={open}
        onClose={() => setOpen(false)}
        title="Choose activity date range"
        className="activity-date-range__popup"
      >
        <div className="activity-date-range__layout">
          <div className="activity-date-range__presets">
            <strong>Quick ranges</strong>
            {quickPresets.map((preset) => (
              <button
                type="button"
                key={preset.value}
                onClick={() => {
                  const providedPreset = presets.find((item) => item.label === preset.label);
                  const range = providedPreset ? undefined : getDateRangePreset(preset.value);
                  if (providedPreset) onPresetSelect(providedPreset.value);
                  else if (range) onRangeApply(range.startDate, range.endDate);
                  else onPresetSelect(preset.value);
                  setOpen(false);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="activity-date-range__calendar">
            <div className="activity-date-range__heading">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMonth((value) => shiftCalendarMonth(value, -1))}
              >
                <ChevronLeft size={16} />
              </button>
              <strong>{monthLabel}</strong>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setMonth((value) => shiftCalendarMonth(value, 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="activity-date-range__days" aria-hidden="true">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="activity-date-range__days">
              {days.map((date, index) => {
                if (!date) return <span key={`empty-${index}`} />;
                const selected = date === draftStart || date === draftEnd;
                const inRange = !!draftStart && !!draftEnd && date > draftStart && date < draftEnd;
                return (
                  <button
                    type="button"
                    key={date}
                    aria-label={formatCalendarDate(date)}
                    aria-pressed={selected}
                    data-range-start={date === draftStart || undefined}
                    data-range-end={(!!draftEnd && date === draftEnd) || undefined}
                    data-in-range={inRange || undefined}
                    data-selected={selected || undefined}
                    onClick={() => chooseDay(date)}
                  >
                    {Number(date.slice(-2))}
                  </button>
                );
              })}
            </div>
            <div className="activity-date-range__selection" aria-live="polite">
              {rangeLabel}
            </div>
            <div className="activity-date-range__actions">
              <button type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!draftStart}
                onClick={() => {
                  if (!draftStart) return;
                  onRangeApply(draftStart, draftEnd || draftStart);
                  setOpen(false);
                }}
              >
                {draftEnd ? 'Apply range' : 'Apply this day'}
              </button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
