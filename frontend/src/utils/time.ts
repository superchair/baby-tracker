// Small date/time formatting helpers. No date library is installed for this
// small app - native Date/Intl cover everything we need.

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** "3:45 PM" */
export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "Aug 31, 3:45 PM" */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "5m ago", "2h 10m ago", "3d ago" - relative to `nowMs`. */
export function formatRelativeSince(iso: string, nowMs: number): string {
  const diffMs = nowMs - new Date(iso).getTime();
  if (diffMs < 60_000) return 'just now';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return remMinutes > 0 ? `${hours}h ${remMinutes}m ago` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Local yyyy-mm-dd bucket key for grouping events by day. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "Aug 31" label for a dayKey. */
export function formatDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Midnight, `daysAgo` days before today, in local time. */
export function startOfDaysAgo(daysAgo: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/** Local yyyy-mm-dd, suitable for an <input type="date"> value. */
export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local yyyy-mm-ddTHH:mm, suitable for an <input type="datetime-local"> value. */
export function toDateTimeInputValue(d: Date): string {
  return `${toDateInputValue(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parses an <input type="datetime-local"> value (local time, no offset) to an ISO string. */
export function dateTimeInputValueToIso(value: string): string {
  return new Date(value).toISOString();
}

/** Minutes since local midnight, e.g. 90 for 1:30 AM. */
export function minutesSinceMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** "12 AM", "4 AM", "12 PM"... for a minutes-since-midnight axis tick. */
export function formatMinutesOfDay(minutes: number): string {
  const d = new Date(2000, 0, 1, 0, minutes);
  return d.toLocaleTimeString([], { hour: 'numeric' });
}
