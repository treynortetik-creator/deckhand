import { FileText } from 'lucide-react';

export default function Templates() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-lg bg-ocean-600/30 flex items-center justify-center">
          <FileText className="w-6 h-6 text-ocean-300" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Templates</h1>
          <p className="text-ocean-400">Chart templates for yer voyages</p>
        </div>
      </div>

      <div className="card text-center py-16">
        <FileText className="w-16 h-16 text-ocean-600 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-semibold text-white mb-2">
          Template Harbor Coming Soon
        </h2>
        <p className="text-ocean-400 max-w-md mx-auto">
          We're building the template docks. Soon ye'll be able to save and reuse yer favorite deck structures.
        </p>
      </div>
    </div>
  );
}
