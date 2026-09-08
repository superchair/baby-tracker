import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, deleteEvent, getEvents } from '../api/client';
import type { Event, EventType } from '../api/types';
import { ErrorBanner } from '../components/ErrorBanner';
import { EditEventForm } from '../components/history/EditEventForm';
import { LoadingScreen } from '../components/LoadingScreen';
import { EVENT_META, summarizeEvent, summarizeTimeRange } from '../utils/eventMeta';
import { formatDateTime, startOfDaysAgo, toDateInputValue } from '../utils/time';

const TYPE_FILTERS: { value: EventType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'FEEDING', label: 'Feeding' },
  { value: 'DIAPER', label: 'Diaper' },
];

export default function History() {
  const [typeFilter, setTypeFilter] = useState<EventType | 'ALL'>('ALL');
  const [from, setFrom] = useState(toDateInputValue(startOfDaysAgo(30)));
  const [to, setTo] = useState(toDateInputValue(new Date()));
  const [caregiverFilter, setCaregiverFilter] = useState<string>('ALL');

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromIso = from ? new Date(`${from}T00:00:00`).toISOString() : undefined;
      const toIso = to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined;
      const res = await getEvents({
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        from: fromIso,
        to: toIso,
      });
      setEvents(res.events);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const caregivers = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => set.add(e.createdBy));
    return Array.from(set).sort();
  }, [events]);

  const visibleEvents = useMemo(() => {
    if (caregiverFilter === 'ALL') return events;
    return events.filter((e) => e.createdBy === caregiverFilter);
  }, [events, caregiverFilter]);

  function handleSaved(updated: Event) {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setEditingId(null);
  }

  async function handleDelete(event: Event) {
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    setDeletingId(event.id);
    try {
      await deleteEvent(event.id, event.startTime);
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete event.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-800">History</h1>

      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTypeFilter(f.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                typeFilter === f.value ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm text-slate-600">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-600">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block text-sm text-slate-600">
          Caregiver
          <select
            value={caregiverFilter}
            onChange={(e) => setCaregiverFilter(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
          >
            <option value="ALL">All caregivers</option>
            {caregivers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <LoadingScreen label="Loading history…" />
      ) : visibleEvents.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No events in this range.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          {visibleEvents.map((event) => {
            const meta = EVENT_META[event.type];
            return (
              <li key={event.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-white ${meta.bgClass}`}>
                  {meta.icon}
                </span>
                {editingId === event.id ? (
                  <EditEventForm event={event} onSaved={handleSaved} onCancel={() => setEditingId(null)} />
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{summarizeEvent(event)}</p>
                      <p className="truncate text-xs text-slate-500">
                        {formatDateTime(event.startTime).split(',')[0]}, {summarizeTimeRange(event)} · {event.createdBy}
                      </p>
                      {event.notes && <p className="truncate text-xs italic text-slate-400">"{event.notes}"</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingId(event.id)}
                      className="shrink-0 rounded-full px-3 py-2 text-xs font-medium text-slate-600 active:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(event)}
                      disabled={deletingId === event.id}
                      className="shrink-0 rounded-full px-3 py-2 text-xs font-medium text-red-600 active:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
