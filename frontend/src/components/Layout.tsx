import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  Ship,
  Compass,
  FileText,
  Image,
  History,
  Settings,
  Menu,
  LogOut,
  X,
  ChevronDown,
  LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '../lib/auth';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/generate', icon: <Compass className="w-5 h-5" />, label: 'Generate' },
  { to: '/templates', icon: <FileText className="w-5 h-5" />, label: 'Templates' },
  { to: '/assets', icon: <Image className="w-5 h-5" />, label: 'Assets' },
  { to: '/history', icon: <History className="w-5 h-5" />, label: 'History' },
  { to: '/admin', icon: <Settings className="w-5 h-5" />, label: 'Admin' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-ocean-950 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-ocean-900 border-r border-ocean-800 transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Sidebar header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-ocean-800">
          <Link to="/" className="flex items-center gap-3">
            <Ship className="w-8 h-8 text-gold-500" />
            <span className="font-display text-xl font-bold text-white">Deckhand</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-ocean-400 hover:text-white"
            aria-label="Close navigation menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                ${
                  isActive(item.to)
                    ? 'bg-gold-500/20 text-gold-500 border-l-4 border-gold-500 -ml-1 pl-5'
                    : 'text-ocean-300 hover:bg-ocean-800 hover:text-white'
                }
              `}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-ocean-900/50 border-b border-ocean-800 flex items-center justify-between px-4 lg:px-6">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-ocean-400 hover:text-white"
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Mobile title */}
          <div className="lg:hidden flex items-center gap-2">
            <Ship className="w-6 h-6 text-gold-500" />
            <span className="font-display text-lg font-bold text-white">Deckhand</span>
          </div>

          {/* Spacer for desktop */}
          <div className="hidden lg:block" />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-ocean-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center">
                <span className="text-gold-500 font-semibold text-sm">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <span className="hidden sm:block text-ocean-200 text-sm">
                {user?.full_name || user?.email || 'User'}
              </span>
              <ChevronDown className="w-4 h-4 text-ocean-400" />
            </button>

            {/* User dropdown */}
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-ocean-900 border border-ocean-700 rounded-lg shadow-xl z-50">
                  <div className="p-3 border-b border-ocean-700">
                    <p className="text-sm font-medium text-white truncate">
                      {user?.full_name || 'Captain'}
                    </p>
                    <p className="text-xs text-ocean-400 truncate">{user?.email}</p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-ocean-800 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Abandon Ship (Logout)</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
