'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover } from '../../web/overlay';
import {
  calendarMonthDays,
  calendarMonthKey,
  formatCalendarDate,
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
    calendarMonthKey(startDate || new Date().toISOString().slice(0, 10)),
  );
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const rootRef = useRef<HTMLDivElement>(null);
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
    setMonth(calendarMonthKey(startDate || new Date().toISOString().slice(0, 10)));
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
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
    ? `${formatCalendarDate(draftStart)}${draftEnd ? ` – ${formatCalendarDate(draftEnd)}` : ' – Choose end date'}`
    : 'Choose a date range';

  return (
    <div className="finapp-filter-option-popover activity-date-range" ref={rootRef}>
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
      <Popover visible={open} className="activity-date-range__popup">
        <div
          role="dialog"
          aria-label="Choose activity date range"
          className="activity-date-range__layout"
        >
          <div className="activity-date-range__presets">
            <strong>Quick ranges</strong>
            {presets.map((preset) => (
              <button
                type="button"
                key={preset.value}
                onClick={() => {
                  onPresetSelect(preset.value);
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
                disabled={!draftStart || !draftEnd}
                onClick={() => {
                  if (!draftStart || !draftEnd) return;
                  onRangeApply(draftStart, draftEnd);
                  setOpen(false);
                }}
              >
                Apply range
              </button>
            </div>
          </div>
        </div>
      </Popover>
    </div>
  );
}
