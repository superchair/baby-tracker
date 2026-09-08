import { useCallback, useEffect, useState } from 'react';
import { ApiError, getEvents } from '../api/client';
import type { Event } from '../api/types';
import { DiaperLogger } from '../components/dashboard/DiaperLogger';
import { FeedingTracker } from '../components/dashboard/FeedingTracker';
import { RecentSummary } from '../components/dashboard/RecentSummary';
import { ErrorBanner } from '../components/ErrorBanner';
import { LoadingScreen } from '../components/LoadingScreen';

type ActiveLogger = 'FEEDING' | 'DIAPER' | null;

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFeeding, setLastFeeding] = useState<Event | null | undefined>(undefined);
  const [lastDiaper, setLastDiaper] = useState<Event | null | undefined>(undefined);
  const [activeLogger, setActiveLogger] = useState<ActiveLogger>(null);

  const refreshAll = useCallback(async () => {
    setError(null);
    try {
      const [feedingRes, diaperRes] = await Promise.all([
        getEvents({ type: 'FEEDING' }),
        getEvents({ type: 'DIAPER' }),
      ]);
      setLastFeeding(feedingRes.events[0] ?? null);
      setLastDiaper(diaperRes.events[0] ?? null);
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
      {activeLogger !== 'DIAPER' && (
        <FeedingTracker
          open={activeLogger === 'FEEDING'}
          onOpen={() => setActiveLogger('FEEDING')}
          onClose={() => setActiveLogger(null)}
          onLogged={refreshAll}
        />
      )}
      {activeLogger !== 'FEEDING' && (
        <DiaperLogger
          open={activeLogger === 'DIAPER'}
          onOpen={() => setActiveLogger('DIAPER')}
          onClose={() => setActiveLogger(null)}
          onLogged={refreshAll}
        />
      )}
    </div>
  );
}
