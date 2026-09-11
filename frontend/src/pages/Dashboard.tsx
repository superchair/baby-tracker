import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ApiError, getEvents } from '../api/client';
import type { Event } from '../api/types';
import { DiaperLogger } from '../components/dashboard/DiaperLogger';
import { FeedingTracker } from '../components/dashboard/FeedingTracker';
import { RecentSummary } from '../components/dashboard/RecentSummary';
import { ErrorBanner } from '../components/ErrorBanner';
import { LoadingScreen } from '../components/LoadingScreen';
import { EVENT_META } from '../utils/eventMeta';

// Lazy-loaded because it pulls in Recharts -- the log buttons above it are
// the most tapped, most latency-sensitive part of the app and shouldn't
// wait on that chunk to download.
const DailyActivityChart = lazy(() =>
  import('../components/dashboard/DailyActivityChart').then((m) => ({ default: m.DailyActivityChart })),
);

function ChartLoadingPlaceholder() {
  return (
    <div className="flex h-[277px] items-center justify-center rounded-2xl bg-white text-sm text-slate-500 shadow-sm ring-1 ring-slate-100">
      Loading…
    </div>
  );
}

type ActiveLogger = 'FEEDING' | 'DIAPER' | null;

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFeeding, setLastFeeding] = useState<Event | null | undefined>(undefined);
  const [lastDiaper, setLastDiaper] = useState<Event | null | undefined>(undefined);
  const [activeLogger, setActiveLogger] = useState<ActiveLogger>(null);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);

  const refreshAll = useCallback(async () => {
    setError(null);
    try {
      const [feedingRes, diaperRes] = await Promise.all([
        getEvents({ type: 'FEEDING', limit: '1' }),
        getEvents({ type: 'DIAPER', limit: '1' }),
      ]);
      setLastFeeding(feedingRes.events[0] ?? null);
      setLastDiaper(diaperRes.events[0] ?? null);
      setActivityRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  if (loading) {
    return <LoadingScreen label="Loading dashboard…" />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {error && <ErrorBanner message={error} onRetry={refreshAll} />}
      <RecentSummary lastFeeding={lastFeeding} lastDiaper={lastDiaper} />
      {activeLogger === null && (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setActiveLogger('FEEDING')}
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-sky-500 py-8 text-white active:bg-sky-600"
            >
              <span className="text-4xl">{EVENT_META.FEEDING.icon}</span>
              <span className="text-lg font-semibold">Log feeding</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveLogger('DIAPER')}
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-amber-500 py-8 text-white active:bg-amber-600"
            >
              <span className="text-4xl">{EVENT_META.DIAPER.icon}</span>
              <span className="text-lg font-semibold">Log diaper change</span>
            </button>
          </div>
        </div>
      )}
      {activeLogger === 'FEEDING' && <FeedingTracker onClose={() => setActiveLogger(null)} onLogged={refreshAll} />}
      {activeLogger === 'DIAPER' && <DiaperLogger onClose={() => setActiveLogger(null)} onLogged={refreshAll} />}
      <Suspense fallback={<ChartLoadingPlaceholder />}>
        <DailyActivityChart refreshKey={activityRefreshKey} />
      </Suspense>
    </div>
  );
}
