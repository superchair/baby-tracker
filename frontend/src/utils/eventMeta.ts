import type { DiaperEvent, Event, EventType } from '../api/types';
import { formatClockTime } from './time';

// Fixed categorical identity colors, used consistently for cards, badges, and
// charts throughout the app (validated for CVD-safe separation).
export const EVENT_META: Record<
  EventType,
  { label: string; icon: string; textClass: string; bgClass: string; ringClass: string; hex: string }
> = {
  FEEDING: {
    label: 'Feeding',
    icon: '\u{1F37C}', // baby bottle
    textClass: 'text-sky-600',
    bgClass: 'bg-sky-500',
    ringClass: 'ring-sky-500',
    hex: '#0ea5e9',
  },
  DIAPER: {
    label: 'Diaper',
    icon: '\u{1F9F7}', // safety pin
    textClass: 'text-amber-600',
    bgClass: 'bg-amber-500',
    ringClass: 'ring-amber-500',
    hex: '#f59e0b',
  },
};

/** One-line human summary of an event's details, for list rows. */
export function summarizeEvent(event: Event): string {
  switch (event.type) {
    case 'FEEDING': {
      const { amountMl } = event.details;
      return amountMl ? `${amountMl}ml` : 'Feeding';
    }
    case 'DIAPER': {
      const { wet, dirty }: DiaperEvent['details'] = event.details;
      if (wet && dirty) return 'Wet & dirty';
      if (wet) return 'Wet';
      if (dirty) return 'Dirty';
      return 'Diaper change';
    }
    default:
      return '';
  }
}

/** Time range label for a list row, e.g. "3:45 PM" or "3:45 PM - 4:10 PM". */
export function summarizeTimeRange(event: Event): string {
  const start = formatClockTime(event.startTime);
  if (!event.endTime || event.endTime === event.startTime) {
    return start;
  }
  return `${start} – ${formatClockTime(event.endTime)}`;
}
