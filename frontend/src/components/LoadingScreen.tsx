export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-3 bg-slate-50 text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-sky-500" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
