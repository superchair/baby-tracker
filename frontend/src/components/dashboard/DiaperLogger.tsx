import { useState } from 'react';
import { ApiError, createEvent } from '../../api/client';
import { dateTimeInputValueToIso, toDateTimeInputValue } from '../../utils/time';

export function DiaperLogger({ onClose, onLogged }: { onClose: () => void; onLogged: () => void }) {
  const [time, setTime] = useState(() => toDateTimeInputValue(new Date()));
  const [wet, setWet] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!wet && !dirty) {
      setError('Select wet and/or dirty.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const iso = dateTimeInputValueToIso(time);
      await createEvent({
        type: 'DIAPER',
        startTime: iso,
        endTime: iso,
        details: { wet, dirty },
      });
      onClose();
      onLogged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log diaper change.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="block text-sm text-slate-600">
          Time
          <input
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setWet((v) => !v)}
            className={`rounded-xl py-3 text-sm font-semibold ${
              wet ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            💧 Wet
          </button>
          <button
            type="button"
            onClick={() => setDirty((v) => !v)}
            className={`rounded-xl py-3 text-sm font-semibold ${
              dirty ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            💩 Dirty
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white active:bg-slate-900 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
