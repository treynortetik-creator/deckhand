import { History as HistoryIcon } from 'lucide-react';

export default function History() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-lg bg-gold-500/20 flex items-center justify-center">
          <HistoryIcon className="w-6 h-6 text-gold-500" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-white">History</h1>
          <p className="text-ocean-400">The captain's log of past voyages</p>
        </div>
      </div>

      <div className="card text-center py-16">
        <HistoryIcon className="w-16 h-16 text-ocean-600 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-semibold text-white mb-2">
          Ship's Log Coming Soon
        </h2>
        <p className="text-ocean-400 max-w-md mx-auto">
          We're preparing the logbook. Soon ye'll be able to view and revisit all yer past document voyages.
        </p>
      </div>
    </div>
  );
}
