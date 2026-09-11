import { useCallback, useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ApiError, getEvents } from '../../api/client';
import type { DiaperEvent, Event, FeedingEvent } from '../../api/types';
import { EVENT_META } from '../../utils/eventMeta';
import { dayKey, formatClockTime, formatDayLabel, formatMinutesOfDay, minutesSinceMidnight, toDateInputValue } from '../../utils/time';
import { ErrorBanner } from '../ErrorBanner';

interface ActivityPoint {
  time: number;
  ml: number;
  label: string;
  kind: 'FEEDING' | 'DIAPER';
  wet?: boolean;
  dirty?: boolean;
}

function buildFeedingPoints(events: Event[], targetDayKey: string): ActivityPoint[] {
  return events
    .filter((e): e is FeedingEvent => e.type === 'FEEDING' && dayKey(e.startTime) === targetDayKey)
    .map((e) => ({
      time: minutesSinceMidnight(e.startTime),
      ml: e.details.amountMl,
      label: formatClockTime(e.startTime),
      kind: 'FEEDING' as const,
    }))
    .sort((a, b) => a.time - b.time);
}

function buildDiaperPoints(events: Event[], targetDayKey: string): ActivityPoint[] {
  return events
    .filter((e): e is DiaperEvent => e.type === 'DIAPER' && dayKey(e.startTime) === targetDayKey)
    .map((e) => ({
      time: minutesSinceMidnight(e.startTime),
      ml: 0,
      label: formatClockTime(e.startTime),
      kind: 'DIAPER' as const,
      wet: e.details.wet,
      dirty: e.details.dirty,
    }))
    .sort((a, b) => a.time - b.time);
}

const DIRTY_DIAPER_COLOR = '#78350f'; // dark brown, vs. the amber used for wet-only

function diaperPointLabel(point: ActivityPoint): string {
  if (point.wet && point.dirty) return 'Wet & dirty diaper';
  if (point.dirty) return 'Dirty diaper';
  return 'Wet diaper';
}

const TIME_AXIS_TICKS = [0, 240, 480, 720, 960, 1200, 1440];

function ActivityTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ActivityPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <p className="text-slate-500">{point.label}</p>
      <p className="font-medium text-slate-700">{point.kind === 'FEEDING' ? `${point.ml} ml` : diaperPointLabel(point)}</p>
    </div>
  );
}

function dotShape(color: string) {
  return (props: { cx?: number; cy?: number }) => <circle cx={props.cx} cy={props.cy} r={5} fill={color} />;
}

export function DailyActivityChart({ refreshKey }: { refreshKey?: number }) {
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (dateStr: string) => {
    setLoading(true);
    setError(null);
    try {
      const from = new Date(`${dateStr}T00:00:00`).toISOString();
      const to = new Date(`${dateStr}T23:59:59.999`).toISOString();
      const res = await getEvents({ from, to });
      setEvents(res.events);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(selectedDate);
  }, [load, selectedDate, refreshKey]);

  const isToday = selectedDate === toDateInputValue(new Date());
  const feeding = useMemo(() => buildFeedingPoints(events, selectedDate), [events, selectedDate]);
  const diaper = useMemo(() => buildDiaperPoints(events, selectedDate), [events, selectedDate]);
  const wetDiaper = diaper.filter((p) => !p.dirty);
  const dirtyDiaper = diaper.filter((p) => p.dirty);
  const isEmpty = feeding.length === 0 && diaper.length === 0;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">
          {isToday ? "Today's activity" : `Activity — ${formatDayLabel(selectedDate)}`}
        </h2>
        <input
          type="date"
          value={selectedDate}
          max={toDateInputValue(new Date())}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-600"
        />
      </div>

      {error && <ErrorBanner message={error} onRetry={() => load(selectedDate)} />}

      {loading ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-slate-500">Loading…</div>
      ) : isEmpty ? (
        <p className="py-8 text-center text-sm text-slate-500">
          {isToday ? 'No activity logged yet today.' : 'No activity logged that day.'}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ top: 16, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="time"
              domain={[0, 1440]}
              ticks={TIME_AXIS_TICKS}
              tickFormatter={formatMinutesOfDay}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              type="number"
              dataKey="ml"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={30}
            />
            <Tooltip content={<ActivityTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Scatter name="Feeding" data={feeding} fill={EVENT_META.FEEDING.hex} shape={dotShape(EVENT_META.FEEDING.hex)} />
            <Scatter name="Wet diaper" data={wetDiaper} fill={EVENT_META.DIAPER.hex} shape={dotShape(EVENT_META.DIAPER.hex)} />
            <Scatter name="Dirty diaper" data={dirtyDiaper} fill={DIRTY_DIAPER_COLOR} shape={dotShape(DIRTY_DIAPER_COLOR)} />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
