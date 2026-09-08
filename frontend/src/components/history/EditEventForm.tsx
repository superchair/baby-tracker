import { useState } from 'react';
import { ApiError, updateEvent } from '../../api/client';
import type { Event } from '../../api/types';
import { dateTimeInputValueToIso, toDateTimeInputValue } from '../../utils/time';

export function EditEventForm({
  event,
  onSaved,
  onCancel,
}: {
  event: Event;
  onSaved: (updated: Event) => void;
  onCancel: () => void;
}) {
  const [time, setTime] = useState(() => toDateTimeInputValue(new Date(event.startTime)));
  const [amountMl, setAmountMl] = useState(event.type === 'FEEDING' ? String(event.details.amountMl) : '');
  const [wet, setWet] = useState(event.type === 'DIAPER' ? event.details.wet : false);
  const [dirty, setDirty] = useState(event.type === 'DIAPER' ? event.details.dirty : false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const details =
      event.type === 'FEEDING'
        ? { amountMl: Number(amountMl) }
        : { wet, dirty };

    if (event.type === 'FEEDING' && !(Number(amountMl) > 0)) {
      setError('Enter the amount.');
      return;
    }
    if (event.type === 'DIAPER' && !wet && !dirty) {
      setError('Select wet and/or dirty.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const iso = dateTimeInputValueToIso(time);
      const updated = await updateEvent(event.id, {
        startTime: event.startTime,
        newStartTime: iso,
        endTime: iso,
        details,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save changes.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        type="datetime-local"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      {event.type === 'FEEDING' ? (
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={amountMl}
          onChange={(e) => setAmountMl(e.target.value)}
          placeholder="Amount (ml)"
          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setWet((v) => !v)}
            className={`rounded-lg py-1.5 text-sm font-medium ${
              wet ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            💧 Wet
          </button>
          <button
            type="button"
            onClick={() => setDirty((v) => !v)}
            className={`rounded-lg py-1.5 text-sm font-medium ${
              dirty ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            💩 Dirty
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg bg-slate-100 py-1.5 text-sm font-semibold text-slate-600 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-slate-800 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
