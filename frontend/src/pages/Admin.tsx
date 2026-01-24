import { Settings } from 'lucide-react';

export default function Admin() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-lg bg-ocean-600/30 flex items-center justify-center">
          <Settings className="w-6 h-6 text-ocean-300" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Admin</h1>
          <p className="text-ocean-400">Captain's quarters - ship settings and crew management</p>
        </div>
      </div>

      <div className="card text-center py-16">
        <Settings className="w-16 h-16 text-ocean-600 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-semibold text-white mb-2">
          Captain's Quarters Coming Soon
        </h2>
        <p className="text-ocean-400 max-w-md mx-auto">
          The admin quarters are being outfitted. Soon ye'll be able to manage yer ship's settings and crew.
        </p>
      </div>
    </div>
  );
}
