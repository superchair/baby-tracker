import type { Event } from '../../api/types';
import { useNowTick } from '../../hooks/useNowTick';
import { EVENT_META } from '../../utils/eventMeta';
import { formatRelativeSince } from '../../utils/time';

function SummaryCard({
  type,
  event,
  now,
}: {
  type: 'FEEDING' | 'DIAPER';
  event: Event | null | undefined;
  now: number;
}) {
  const meta = EVENT_META[type];
  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
      <span className="text-2xl">{meta.icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">Since last {meta.label.toLowerCase()}</p>
        <p className="truncate text-sm font-semibold text-slate-800">
          {event === undefined ? '…' : event ? formatRelativeSince(event.startTime, now) : 'No data yet'}
        </p>
      </div>
    </div>
  );
}

export function RecentSummary({
  lastFeeding,
  lastDiaper,
}: {
  lastFeeding: Event | null | undefined;
  lastDiaper: Event | null | undefined;
}) {
  const now = useNowTick(30_000);
  return (
    <div className="flex gap-3">
      <SummaryCard type="FEEDING" event={lastFeeding} now={now} />
      <SummaryCard type="DIAPER" event={lastDiaper} now={now} />
    </div>
  );
}
