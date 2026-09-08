import { useState } from 'react';
import { ApiError, createEvent } from '../../api/client';
import { EVENT_META } from '../../utils/eventMeta';
import { dateTimeInputValueToIso, toDateTimeInputValue } from '../../utils/time';

const QUICK_AMOUNTS = [30, 60, 90];

export function FeedingTracker({
  open,
  onOpen,
  onClose,
  onLogged,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onLogged: () => void;
}) {
  const meta = EVENT_META.FEEDING;
  const [time, setTime] = useState(() => toDateTimeInputValue(new Date()));
  const [amountMl, setAmountMl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTime(toDateTimeInputValue(new Date()));
    setAmountMl('');
    setError(null);
  }

  async function submit() {
    const amount = Number(amountMl);
    if (!amountMl || !(amount > 0)) {
      setError('Enter the amount.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const iso = dateTimeInputValueToIso(time);
      await createEvent({
        type: 'FEEDING',
        startTime: iso,
        endTime: iso,
        details: { amountMl: amount },
      });
      reset();
      onClose();
      onLogged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log feeding.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            reset();
            onOpen();
          }}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl bg-sky-500 py-12 text-white active:bg-sky-600"
        >
          <span className="text-4xl">{meta.icon}</span>
          <span className="text-lg font-semibold">Log feeding</span>
        </button>
      ) : (
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
          <div>
            <p className="mb-1 text-sm text-slate-600">Quick set</p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setAmountMl(String(amount))}
                  className={`rounded-xl py-4 text-lg font-semibold ${
                    amountMl === String(amount) ? 'bg-sky-500 text-white' : 'bg-sky-50 text-sky-700'
                  }`}
                >
                  {amount} ml
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm text-slate-600">
            Amount (ml)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={amountMl}
              onChange={(e) => setAmountMl(e.target.value)}
              placeholder="e.g. 120"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
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
      )}
    </div>
  );
}
