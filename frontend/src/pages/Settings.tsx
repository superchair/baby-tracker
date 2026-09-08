import { useCallback, useEffect, useState } from 'react';
import { ApiError, getConfig, getVapidPublicKey, subscribePush, updateConfig } from '../api/client';
import type { BabyConfig } from '../api/types';
import { ErrorBanner } from '../components/ErrorBanner';
import { LoadingScreen } from '../components/LoadingScreen';
import { getServiceWorkerRegistration, urlBase64ToUint8Array } from '../utils/push';

function minutesToHoursString(minutes: number): string {
  return (minutes / 60).toString();
}

function hoursStringToMinutes(hours: string): number {
  const n = Number(hours);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : 0;
}

type PushStatus = { kind: 'idle' | 'busy' | 'success' | 'error' | 'unsupported'; message?: string };

export default function Settings() {
  const [config, setConfig] = useState<BabyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [babyName, setBabyName] = useState('');
  const [babyBirthDate, setBabyBirthDate] = useState('');
  const [feedingHours, setFeedingHours] = useState('3');
  const [diaperHours, setDiaperHours] = useState('3');

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [pushStatus, setPushStatus] = useState<PushStatus>({ kind: 'idle' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await getConfig();
      setConfig(cfg);
      setBabyName(cfg.babyName ?? '');
      setBabyBirthDate(cfg.babyBirthDate ?? '');
      setFeedingHours(minutesToHoursString(cfg.reminderThresholds.feedingMin));
      setDiaperHours(minutesToHoursString(cfg.reminderThresholds.diaperMin));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const updated = await updateConfig({
        babyName,
        babyBirthDate: babyBirthDate || null,
        reminderThresholds: {
          feedingMin: hoursStringToMinutes(feedingHours),
          diaperMin: hoursStringToMinutes(diaperHours),
        },
      });
      setConfig(updated);
      setSaveMessage('Saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEnableNotifications() {
    setPushStatus({ kind: 'busy' });
    try {
      if (!('Notification' in window) || !('PushManager' in window)) {
        setPushStatus({ kind: 'unsupported', message: 'Push notifications are not supported in this browser.' });
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus({ kind: 'error', message: 'Notification permission was not granted.' });
        return;
      }

      const registration = await getServiceWorkerRegistration();
      const { key } = await getVapidPublicKey();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('Browser did not return a usable push subscription.');
      }

      await subscribePush({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });

      setPushStatus({ kind: 'success', message: 'Notifications enabled on this device.' });
    } catch (err) {
      setPushStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not enable notifications.',
      });
    }
  }

  if (loading) {
    return <LoadingScreen label="Loading settings…" />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-lg font-semibold text-slate-800">Settings</h1>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <label className="block text-sm font-medium text-slate-600">
          Baby's name
          <input
            type="text"
            value={babyName}
            onChange={(e) => setBabyName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
          />
        </label>

        <label className="block text-sm font-medium text-slate-600">
          Birth date
          <input
            type="date"
            value={babyBirthDate ?? ''}
            onChange={(e) => setBabyBirthDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-slate-600">
            Feeding reminder (hours)
            <input
              type="number"
              min={0}
              step={0.5}
              value={feedingHours}
              onChange={(e) => setFeedingHours(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
            />
          </label>
          <label className="block text-sm font-medium text-slate-600">
            Diaper reminder (hours)
            <input
              type="number"
              min={0}
              step={0.5}
              value={diaperHours}
              onChange={(e) => setDiaperHours(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
            />
          </label>
        </div>

        {saveMessage && <p className="text-sm text-emerald-600">{saveMessage}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-sky-500 py-3 text-base font-semibold text-white active:bg-sky-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">Notifications</h2>
        <p className="text-sm text-slate-500">
          Get a push notification when it's been a while since the last feeding or diaper change.
        </p>
        {pushStatus.kind === 'success' && <p className="text-sm text-emerald-600">{pushStatus.message}</p>}
        {(pushStatus.kind === 'error' || pushStatus.kind === 'unsupported') && (
          <p className="text-sm text-red-600">{pushStatus.message}</p>
        )}
        <button
          type="button"
          onClick={handleEnableNotifications}
          disabled={pushStatus.kind === 'busy'}
          className="w-full rounded-xl bg-slate-800 py-3 text-base font-semibold text-white active:bg-slate-900 disabled:opacity-50"
        >
          {pushStatus.kind === 'busy' ? 'Enabling…' : 'Enable notifications'}
        </button>
      </div>

      {config && (
        <p className="text-center text-xs text-slate-400">
          Baby ID stored server-side · thresholds saved as {hoursStringToMinutes(feedingHours)}m / {hoursStringToMinutes(diaperHours)}m
        </p>
      )}
    </div>
  );
}
