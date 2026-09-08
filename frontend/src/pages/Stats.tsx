import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ApiError, getEvents } from '../api/client';
import type { DiaperEvent, Event, FeedingEvent } from '../api/types';
import { ErrorBanner } from '../components/ErrorBanner';
import { LoadingScreen } from '../components/LoadingScreen';
import { EVENT_META } from '../utils/eventMeta';
import {
  dayKey,
  formatClockTime,
  formatDayLabel,
  formatMinutesOfDay,
  minutesSinceMidnight,
  startOfDaysAgo,
} from '../utils/time';

type RangeDays = 7 | 30;

interface DayRow {
  date: string;
  value: number;
}

function buildDayKeys(rangeDays: RangeDays): string[] {
  const keys: string[] = [];
  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    keys.push(dayKey(startOfDaysAgo(i).toISOString()));
  }
  return keys;
}

interface TodayActivityPoint {
  time: number;
  ml: number;
  label: string;
  kind: 'FEEDING' | 'DIAPER';
  wet?: boolean;
  dirty?: boolean;
}

function buildTodayFeedingPoints(events: Event[]): TodayActivityPoint[] {
  const todayKey = dayKey(new Date().toISOString());
  return events
    .filter((e): e is FeedingEvent => e.type === 'FEEDING' && dayKey(e.startTime) === todayKey)
    .map((e) => ({
      time: minutesSinceMidnight(e.startTime),
      ml: e.details.amountMl,
      label: formatClockTime(e.startTime),
      kind: 'FEEDING' as const,
    }))
    .sort((a, b) => a.time - b.time);
}

function buildTodayDiaperPoints(events: Event[]): TodayActivityPoint[] {
  const todayKey = dayKey(new Date().toISOString());
  return events
    .filter((e): e is DiaperEvent => e.type === 'DIAPER' && dayKey(e.startTime) === todayKey)
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

function diaperPointLabel(point: TodayActivityPoint): string {
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
  payload?: Array<{ payload: TodayActivityPoint }>;
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

function TodayActivityChart({ feeding, diaper }: { feeding: TodayActivityPoint[]; diaper: TodayActivityPoint[] }) {
  const isEmpty = feeding.length === 0 && diaper.length === 0;
  const wetDiaper = diaper.filter((p) => !p.dirty);
  const dirtyDiaper = diaper.filter((p) => p.dirty);
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Today's activity</h2>
      {isEmpty ? (
        <p className="py-8 text-center text-sm text-slate-500">No activity logged yet today.</p>
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

function buildSeries(events: Event[], dayKeys: string[], predicate: (e: Event) => number): DayRow[] {
  const totals = new Map<string, number>(dayKeys.map((k) => [k, 0]));
  for (const event of events) {
    const key = dayKey(event.startTime);
    if (!totals.has(key)) continue;
    totals.set(key, (totals.get(key) ?? 0) + predicate(event));
  }
  return dayKeys.map((key) => ({ date: formatDayLabel(key), value: Math.round((totals.get(key) ?? 0) * 10) / 10 }));
}

interface FeedingVolumeRow {
  date: string;
  totalMl: number;
  avgMl: number;
}

function buildFeedingVolumeSeries(events: Event[], dayKeys: string[]): FeedingVolumeRow[] {
  const totals = new Map<string, number>(dayKeys.map((k) => [k, 0]));
  const counts = new Map<string, number>(dayKeys.map((k) => [k, 0]));
  for (const event of events) {
    if (event.type !== 'FEEDING') continue;
    const key = dayKey(event.startTime);
    if (!totals.has(key)) continue;
    totals.set(key, (totals.get(key) ?? 0) + event.details.amountMl);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return dayKeys.map((key) => {
    const total = totals.get(key) ?? 0;
    const count = counts.get(key) ?? 0;
    return {
      date: formatDayLabel(key),
      totalMl: Math.round(total),
      avgMl: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
    };
  });
}

const AVG_LINE_COLOR = '#6366f1'; // indigo - distinct from the feeding bar's sky blue

function FeedingVolumeChart({ data }: { data: FeedingVolumeRow[] }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Feeding volume per day</h2>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 16, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            interval={data.length > 10 ? Math.ceil(data.length / 8) : 0}
          />
          <YAxis
            yAxisId="total"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={34}
          />
          <YAxis
            yAxisId="avg"
            orientation="right"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={34}
          />
          <Tooltip
            formatter={(value, name) => [`${value} ml`, name] as [string, string]}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            yAxisId="total"
            dataKey="totalMl"
            name="Total (ml)"
            fill={EVENT_META.FEEDING.hex}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Line
            yAxisId="avg"
            type="monotone"
            dataKey="avgMl"
            name="Average per feeding (ml)"
            stroke={AVG_LINE_COLOR}
            strokeWidth={2}
            dot={{ r: 3, fill: AVG_LINE_COLOR }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartCard({
  title,
  data,
  color,
  unit,
  showLabels,
}: {
  title: string;
  data: DayRow[];
  color: string;
  unit: string;
  showLabels: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 16, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            interval={data.length > 10 ? Math.ceil(data.length / 8) : 0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={24}
          />
          <Tooltip
            formatter={(value) => [`${value} ${unit}`, title] as [string, string]}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28}>
            {showLabels && <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: '#334155' }} />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Stats() {
  const [range, setRange] = useState<RangeDays>(7);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (rangeDays: RangeDays) => {
    setLoading(true);
    setError(null);
    try {
      const from = startOfDaysAgo(rangeDays - 1).toISOString();
      const to = new Date().toISOString();
      const res = await getEvents({ from, to });
      setEvents(res.events);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load stats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [load, range]);

  const dayKeys = useMemo(() => buildDayKeys(range), [range]);

  const feedingSeries = useMemo(
    () => buildSeries(events, dayKeys, (e) => (e.type === 'FEEDING' ? 1 : 0)),
    [events, dayKeys],
  );
  const diaperSeries = useMemo(
    () => buildSeries(events, dayKeys, (e) => (e.type === 'DIAPER' ? 1 : 0)),
    [events, dayKeys],
  );
  const feedingVolumeSeries = useMemo(
    () => buildFeedingVolumeSeries(events, dayKeys),
    [events, dayKeys],
  );
  const todayFeedingPoints = useMemo(() => buildTodayFeedingPoints(events), [events]);
  const todayDiaperPoints = useMemo(() => buildTodayDiaperPoints(events), [events]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Stats</h1>
        <div className="flex gap-2">
          {([7, 30] as RangeDays[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                range === r ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Last {r}d
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => load(range)} />}

      {loading ? (
        <LoadingScreen label="Loading stats…" />
      ) : (
        <div className="space-y-4">
          <TodayActivityChart feeding={todayFeedingPoints} diaper={todayDiaperPoints} />
          <ChartCard
            title="Feedings per day"
            data={feedingSeries}
            color={EVENT_META.FEEDING.hex}
            unit="feedings"
            showLabels={range === 7}
          />
          <FeedingVolumeChart data={feedingVolumeSeries} />
          <ChartCard
            title="Diaper changes per day"
            data={diaperSeries}
            color={EVENT_META.DIAPER.hex}
            unit="changes"
            showLabels={range === 7}
          />
        </div>
      )}
    </div>
  );
}
