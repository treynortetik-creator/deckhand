import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import {
  Ship,
  Compass,
  Anchor,
  LayoutDashboard,
  FileText,
  FolderOpen,
  Settings,
  LogOut,
} from 'lucide-react';
import { ProtectedRoute, useAuth } from './lib/auth';
import Generate from './pages/Generate';
import Login from './pages/Login';
import Register from './pages/Register';

function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-ocean-950">
      {/* Header */}
      <header className="border-b border-ocean-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Ship className="w-8 h-8 text-gold-500" />
            <span className="font-display text-2xl font-bold text-white">Deckhand</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              to="/generate"
              className="flex items-center gap-2 text-ocean-200 hover:text-white transition-colors"
            >
              <Compass className="w-4 h-4" />
              Generate
            </Link>
            <Link
              to="/dashboard"
              className="flex items-center gap-2 text-ocean-200 hover:text-white transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <Link
              to="/templates"
              className="flex items-center gap-2 text-ocean-200 hover:text-white transition-colors"
            >
              <FileText className="w-4 h-4" />
              Templates
            </Link>
            <Link
              to="/assets"
              className="flex items-center gap-2 text-ocean-200 hover:text-white transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Assets
            </Link>
            <Link
              to="/admin"
              className="flex items-center gap-2 text-ocean-200 hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
              Admin
            </Link>
            <div className="flex items-center gap-4 ml-4 pl-4 border-l border-ocean-700">
              <span className="text-ocean-300 text-sm">{user?.email}</span>
              <button
                onClick={logout}
                className="flex items-center gap-2 text-ocean-400 hover:text-red-400 transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="font-display text-5xl font-bold text-white mb-4">
            Chart Your Course to Perfect Decks
          </h1>
          <p className="text-xl text-ocean-300 max-w-2xl mx-auto">
            Navigate the seas of deck generation with ease. From quick presentations to
            treasure-worthy slides, Deckhand has ye covered.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Quick Generate Card */}
          <Link to="/generate" className="card cursor-pointer group">
            <div className="w-12 h-12 rounded-lg bg-gold-500/20 flex items-center justify-center mb-4 group-hover:bg-gold-500/30 transition-colors">
              <Compass className="w-6 h-6 text-gold-500" />
            </div>
            <h3 className="font-display text-xl font-semibold text-white mb-2">Quick Generate</h3>
            <p className="text-ocean-300 mb-4">
              Set sail immediately with a simple prompt. Perfect for quick decks and presentations.
            </p>
            <span className="btn-primary w-full">Start Generating</span>
          </Link>

          {/* From Template Card */}
          <Link to="/templates" className="card cursor-pointer group">
            <div className="w-12 h-12 rounded-lg bg-ocean-600/30 flex items-center justify-center mb-4 group-hover:bg-ocean-600/50 transition-colors">
              <Anchor className="w-6 h-6 text-ocean-300" />
            </div>
            <h3 className="font-display text-xl font-semibold text-white mb-2">From Template</h3>
            <p className="text-ocean-300 mb-4">
              Drop anchor on a proven template. Customize and fill in the details your way.
            </p>
            <span className="btn-secondary w-full">Browse Templates</span>
          </Link>

          {/* Advanced Voyage Card */}
          <div className="card cursor-pointer group">
            <div className="w-12 h-12 rounded-lg bg-wood-600/30 flex items-center justify-center mb-4 group-hover:bg-wood-600/50 transition-colors">
              <Ship className="w-6 h-6 text-wood-300" />
            </div>
            <h3 className="font-display text-xl font-semibold text-white mb-2">Advanced Voyage</h3>
            <p className="text-ocean-300 mb-4">
              Plot a complex journey with full control. Multi-slide decks, custom layouts, and more.
            </p>
            <span className="btn-secondary w-full">Plan Voyage</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-6 rounded-lg bg-ocean-900/50 border border-ocean-800">
            <div className="text-3xl font-bold text-gold-500">0</div>
            <div className="text-ocean-400 text-sm">Decks Generated</div>
          </div>
          <div className="text-center p-6 rounded-lg bg-ocean-900/50 border border-ocean-800">
            <div className="text-3xl font-bold text-gold-500">0</div>
            <div className="text-ocean-400 text-sm">Templates Available</div>
          </div>
          <div className="text-center p-6 rounded-lg bg-ocean-900/50 border border-ocean-800">
            <div className="text-3xl font-bold text-gold-500">0</div>
            <div className="text-ocean-400 text-sm">Assets Uploaded</div>
          </div>
          <div className="text-center p-6 rounded-lg bg-ocean-900/50 border border-ocean-800">
            <div className="text-3xl font-bold text-gold-500">--</div>
            <div className="text-ocean-400 text-sm">API Status</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-ocean-800 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-ocean-500 text-sm">
          Deckhand - Your trusty deck generation companion
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/generate"
          element={
            <ProtectedRoute>
              <Generate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
