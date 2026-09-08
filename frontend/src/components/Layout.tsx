import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/history', label: 'History', icon: '📋', end: false },
  { to: '/stats', label: 'Stats', icon: '📊', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙️', end: false },
];

function navLinkClass(isActive: boolean, extra = ''): string {
  return [
    'flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium',
    isActive ? 'text-sky-600' : 'text-slate-500',
    extra,
  ].join(' ');
}

export function Layout() {
  const { name, logout } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      {/* Top nav - desktop / tablet */}
      <header className="hidden border-b border-slate-200 bg-white px-6 py-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
        <span className="justify-self-start text-lg font-semibold text-slate-800">👶 Baby Tracker</span>
        <nav className="flex items-center justify-self-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'rounded-full px-4 py-2 text-sm font-medium',
                  isActive ? 'bg-sky-100 text-sky-700' : 'text-slate-600 hover:bg-slate-100',
                ].join(' ')
              }
            >
              {item.icon} {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex min-w-0 items-center justify-self-end gap-3 text-sm text-slate-500">
          <span className="max-w-[14rem] truncate">Hi, {name}</span>
          <button
            type="button"
            onClick={logout}
            className="shrink-0 rounded-full bg-slate-100 px-4 py-2 font-medium text-slate-700 hover:bg-slate-200"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 px-4 pb-24 pt-4 sm:pb-8">
        <Outlet />
      </main>

      {/* Bottom tab bar - mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => navLinkClass(isActive, 'py-2')}
          >
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <button type="button" onClick={logout} className={navLinkClass(false, 'py-2')}>
          <span className="text-xl">🚪</span>
          Log out
        </button>
      </nav>
    </div>
  );
}
