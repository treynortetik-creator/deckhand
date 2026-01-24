import { Link } from 'react-router-dom';
import { Compass, Anchor, Image, Clock, FileText, FolderOpen, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function Dashboard() {
  const { user } = useAuth();

  // Placeholder data for recent decks (will fetch from API later)
  const recentDecks: { id: string; title: string; createdAt: string }[] = [];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-white mb-2">
          Ahoy, {user?.full_name?.split(' ')[0] || 'Captain'}!
        </h1>
        <p className="text-ocean-300 text-lg">
          Ready to chart your course? The seas of creation await ye.
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-10">
        {/* Quick Generate Card */}
        <Link to="/generate" className="card cursor-pointer group">
          <div className="w-12 h-12 rounded-lg bg-gold-500/20 flex items-center justify-center mb-4 group-hover:bg-gold-500/30 transition-colors">
            <Compass className="w-6 h-6 text-gold-500" />
          </div>
          <h3 className="font-display text-xl font-semibold text-white mb-2">Quick Generate</h3>
          <p className="text-ocean-300 mb-4">
            Set sail immediately with a simple prompt. Perfect for quick documents and reports.
          </p>
          <span className="btn-primary w-full inline-flex items-center justify-center">
            <Sparkles className="w-4 h-4 mr-2" />
            Start Generating
          </span>
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
          <span className="btn-secondary w-full inline-flex items-center justify-center">
            <FileText className="w-4 h-4 mr-2" />
            Browse Templates
          </span>
        </Link>

        {/* Browse Assets Card */}
        <Link to="/assets" className="card cursor-pointer group">
          <div className="w-12 h-12 rounded-lg bg-wood-600/30 flex items-center justify-center mb-4 group-hover:bg-wood-600/50 transition-colors">
            <Image className="w-6 h-6 text-wood-300" />
          </div>
          <h3 className="font-display text-xl font-semibold text-white mb-2">Browse Assets</h3>
          <p className="text-ocean-300 mb-4">
            Manage yer treasure chest of images, logos, and brand materials.
          </p>
          <span className="btn-secondary w-full inline-flex items-center justify-center">
            <FolderOpen className="w-4 h-4 mr-2" />
            View Assets
          </span>
        </Link>
      </div>

      {/* Recent Decks Section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-gold-500" />
            Recent Voyages
          </h2>
          <Link to="/history" className="text-ocean-300 hover:text-gold-500 transition-colors text-sm">
            View all history
          </Link>
        </div>

        {recentDecks.length > 0 ? (
          <div className="grid gap-4">
            {recentDecks.map((deck) => (
              <div
                key={deck.id}
                className="p-4 rounded-lg bg-ocean-900/50 border border-ocean-800 hover:border-ocean-600 transition-colors flex items-center justify-between"
              >
                <div>
                  <h4 className="text-white font-medium">{deck.title}</h4>
                  <p className="text-ocean-400 text-sm">{deck.createdAt}</p>
                </div>
                <button className="btn-secondary text-sm py-2 px-4">View</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-lg bg-ocean-900/30 border border-ocean-800 text-center">
            <p className="text-ocean-400 mb-4">
              No voyages logged yet. Time to set sail and create yer first document!
            </p>
            <Link to="/generate" className="btn-primary inline-flex items-center">
              <Compass className="w-4 h-4 mr-2" />
              Create Your First Deck
            </Link>
          </div>
        )}
      </div>

      {/* Stats Section */}
      <div>
        <h2 className="font-display text-2xl font-semibold text-white mb-4">Ship's Log</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-6 rounded-lg bg-ocean-900/50 border border-ocean-800">
            <div className="text-3xl font-bold text-gold-500">0</div>
            <div className="text-ocean-400 text-sm">Decks Generated</div>
          </div>
          <div className="text-center p-6 rounded-lg bg-ocean-900/50 border border-ocean-800">
            <div className="text-3xl font-bold text-gold-500">0</div>
            <div className="text-ocean-400 text-sm">Templates</div>
          </div>
          <div className="text-center p-6 rounded-lg bg-ocean-900/50 border border-ocean-800">
            <div className="text-3xl font-bold text-gold-500">0</div>
            <div className="text-ocean-400 text-sm">Assets</div>
          </div>
          <div className="text-center p-6 rounded-lg bg-ocean-900/50 border border-ocean-800">
            <div className="text-3xl font-bold text-ocean-300">Active</div>
            <div className="text-ocean-400 text-sm">Crew Status</div>
          </div>
        </div>
      </div>
    </div>
  );
}
