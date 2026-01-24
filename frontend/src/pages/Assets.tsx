import { Image } from 'lucide-react';

export default function Assets() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-lg bg-wood-600/30 flex items-center justify-center">
          <Image className="w-6 h-6 text-wood-300" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Assets</h1>
          <p className="text-ocean-400">Yer treasure chest of images and brand materials</p>
        </div>
      </div>

      <div className="card text-center py-16">
        <Image className="w-16 h-16 text-ocean-600 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-semibold text-white mb-2">
          Treasure Chest Under Construction
        </h2>
        <p className="text-ocean-400 max-w-md mx-auto">
          The asset vault is being fortified. Soon ye'll be able to upload and manage all yer brand treasures.
        </p>
      </div>
    </div>
  );
}
