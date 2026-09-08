export function FullScreenError({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <p className="text-3xl">⚠️</p>
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      <p className="max-w-sm text-sm text-slate-500">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-full bg-sky-500 px-6 py-3 text-sm font-medium text-white active:bg-sky-600"
        >
          Try again
        </button>
      )}
    </div>
  );
}
