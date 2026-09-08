import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LocationState {
  from?: { pathname: string };
}

export default function Login() {
  const { login, error } = useAuth();
  const location = useLocation();

  function handleLogin() {
    const state = location.state as LocationState | null;
    login(state?.from?.pathname);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
        <p className="text-4xl">👶</p>
        <h1 className="text-xl font-semibold text-slate-800">Baby Tracker</h1>
        <p className="text-sm text-slate-500">Log in to track feeding and diaper changes.</p>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="button"
          onClick={handleLogin}
          className="w-full rounded-xl bg-sky-500 py-3 text-base font-semibold text-white active:bg-sky-600"
        >
          Log in
        </button>
      </div>
    </div>
  );
}
