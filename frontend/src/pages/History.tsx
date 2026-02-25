import { useState, useEffect } from 'react';
import {
  History as HistoryIcon,
  ExternalLink,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
  Anchor,
} from 'lucide-react';
import {
  historyApi,
  exportApi,
  type DeckHistoryItem,
  type GenerationHistoryItem,
} from '../lib/api';

// Helper to format dates nicely
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Helper to truncate text
function truncateText(text: string | null, maxLength: number = 100): string {
  if (!text) return 'No prompt recorded';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Helper to format generation time
function formatGenerationTime(seconds: number | null): string {
  if (seconds === null) return 'N/A';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

export default function History() {
  // Deck history state
  const [decks, setDecks] = useState<DeckHistoryItem[]>([]);
  const [decksTotal, setDecksTotal] = useState(0);
  const [decksLoading, setDecksLoading] = useState(true);
  const [decksError, setDecksError] = useState<string | null>(null);

  // Generation history state
  const [generations, setGenerations] = useState<GenerationHistoryItem[]>([]);
  const [generationsTotal, setGenerationsTotal] = useState(0);
  const [generationsLoading, setGenerationsLoading] = useState(true);
  const [generationsError, setGenerationsError] = useState<string | null>(null);
  const [generationsExpanded, setGenerationsExpanded] = useState(false);

  // Filter state
  const [successFilter, setSuccessFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });

  // Pagination
  const [decksPage, setDecksPage] = useState(0);
  const [generationsPage, setGenerationsPage] = useState(0);
  const PAGE_SIZE = 10;

  // Fetch deck history
  useEffect(() => {
    const fetchDecks = async () => {
      setDecksLoading(true);
      setDecksError(null);
      try {
        const response = await historyApi.decks({
          skip: decksPage * PAGE_SIZE,
          limit: PAGE_SIZE,
        });
        let filteredDecks = response.data.decks;

        // Apply date filter client-side (could be moved to backend)
        if (dateRange.start || dateRange.end) {
          filteredDecks = filteredDecks.filter((deck) => {
            const deckDate = new Date(deck.created_at);
            if (dateRange.start && deckDate < new Date(dateRange.start)) return false;
            if (dateRange.end && deckDate > new Date(dateRange.end + 'T23:59:59')) return false;
            return true;
          });
        }

        setDecks(filteredDecks);
        setDecksTotal(response.data.total);
      } catch {
        setDecksError('Failed to load deck history. The sea be rough today.');
      } finally {
        setDecksLoading(false);
      }
    };

    fetchDecks();
  }, [decksPage, dateRange]);

  // Fetch generation history
  useEffect(() => {
    const fetchGenerations = async () => {
      setGenerationsLoading(true);
      setGenerationsError(null);
      try {
        const response = await historyApi.generations({
          skip: generationsPage * PAGE_SIZE,
          limit: PAGE_SIZE,
          success_only: successFilter === 'success' ? true : undefined,
        });
        let filteredGenerations = response.data.history;

        // Apply failed filter client-side (success_only is handled by API)
        if (successFilter === 'failed') {
          filteredGenerations = filteredGenerations.filter((g) => !g.success);
        }

        // Apply date filter client-side
        if (dateRange.start || dateRange.end) {
          filteredGenerations = filteredGenerations.filter((gen) => {
            const genDate = new Date(gen.created_at);
            if (dateRange.start && genDate < new Date(dateRange.start)) return false;
            if (dateRange.end && genDate > new Date(dateRange.end + 'T23:59:59')) return false;
            return true;
          });
        }

        setGenerations(filteredGenerations);
        setGenerationsTotal(response.data.total);
      } catch {
        setGenerationsError('Failed to load generation history. Davy Jones be holding the records.');
      } finally {
        setGenerationsLoading(false);
      }
    };

    fetchGenerations();
  }, [generationsPage, successFilter, dateRange]);

  // Handle PPTX download
  const handleDownloadPptx = (deckId: number) => {
    window.open(exportApi.downloadPptx(deckId), '_blank');
  };

  // Handle Google Slides link
  const handleOpenGoogleSlides = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-lg bg-gold-500/20 flex items-center justify-center">
          <HistoryIcon className="w-6 h-6 text-gold-500" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Ship's Log</h1>
          <p className="text-ocean-400">A record of all past voyages and expeditions</p>
        </div>
      </div>

      {/* Filters Section */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gold-500" />
          <h2 className="font-display text-lg font-semibold text-white">Filters</h2>
        </div>
        <div className="flex flex-wrap gap-4">
          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-ocean-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="bg-ocean-900 border border-ocean-700 rounded px-3 py-2 text-white text-sm focus:border-gold-500 focus:outline-none"
              placeholder="Start date"
            />
            <span className="text-ocean-400">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="bg-ocean-900 border border-ocean-700 rounded px-3 py-2 text-white text-sm focus:border-gold-500 focus:outline-none"
              placeholder="End date"
            />
            {(dateRange.start || dateRange.end) && (
              <button
                onClick={() => setDateRange({ start: '', end: '' })}
                className="text-ocean-400 hover:text-gold-500 text-sm underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Success Filter (for generations) */}
          <div className="flex items-center gap-2">
            <span className="text-ocean-400 text-sm">Status:</span>
            <select
              value={successFilter}
              onChange={(e) => setSuccessFilter(e.target.value as 'all' | 'success' | 'failed')}
              className="bg-ocean-900 border border-ocean-700 rounded px-3 py-2 text-white text-sm focus:border-gold-500 focus:outline-none"
            >
              <option value="all">All Generations</option>
              <option value="success">Successful Only</option>
              <option value="failed">Failed Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Deck History Section */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Anchor className="w-5 h-5 text-gold-500" />
          <h2 className="font-display text-xl font-semibold text-white">Past Voyages</h2>
          <span className="text-ocean-400 text-sm">({decksTotal} decks)</span>
        </div>

        {decksLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full" />
            <span className="ml-3 text-ocean-400">Loading the ship's log...</span>
          </div>
        ) : decksError ? (
          <div className="text-center py-8">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
            <p className="text-red-400">{decksError}</p>
          </div>
        ) : decks.length === 0 ? (
          <div className="text-center py-12">
            <HistoryIcon className="w-16 h-16 text-ocean-600 mx-auto mb-4" />
            <h3 className="font-display text-xl font-semibold text-white mb-2">No Voyages Yet</h3>
            <p className="text-ocean-400">
              The log be empty, Captain. Set sail and create yer first deck!
            </p>
          </div>
        ) : (
          <>
            {/* Deck Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-ocean-700">
                    <th className="text-left py-3 px-4 text-ocean-400 font-medium text-sm">Title</th>
                    <th className="text-left py-3 px-4 text-ocean-400 font-medium text-sm">Prompt</th>
                    <th className="text-left py-3 px-4 text-ocean-400 font-medium text-sm">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Gen Time
                    </th>
                    <th className="text-left py-3 px-4 text-ocean-400 font-medium text-sm">Date</th>
                    <th className="text-right py-3 px-4 text-ocean-400 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {decks.map((deck) => (
                    <tr
                      key={deck.id}
                      className="border-b border-ocean-800 hover:bg-ocean-900/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="text-white font-medium">{deck.title}</span>
                        {deck.model_used && (
                          <span className="ml-2 text-xs text-ocean-500 bg-ocean-800 px-2 py-0.5 rounded">
                            {deck.model_used}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-ocean-300 text-sm max-w-xs">
                        {truncateText(deck.prompt_used, 80)}
                      </td>
                      <td className="py-3 px-4 text-ocean-400 text-sm">
                        {formatGenerationTime(deck.generation_time_seconds)}
                      </td>
                      <td className="py-3 px-4 text-ocean-400 text-sm">{formatDate(deck.created_at)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          {deck.google_slides_url && (
                            <button
                              onClick={() => handleOpenGoogleSlides(deck.google_slides_url!)}
                              className="p-2 hover:bg-ocean-700 rounded transition-colors group"
                              title="Open in Google Slides"
                            >
                              <ExternalLink className="w-4 h-4 text-ocean-400 group-hover:text-gold-500" />
                            </button>
                          )}
                          {deck.pptx_file_path && (
                            <button
                              onClick={() => handleDownloadPptx(deck.id)}
                              className="p-2 hover:bg-ocean-700 rounded transition-colors group"
                              title="Download PPTX"
                            >
                              <Download className="w-4 h-4 text-ocean-400 group-hover:text-gold-500" />
                            </button>
                          )}
                          {!deck.google_slides_url && !deck.pptx_file_path && (
                            <span className="text-ocean-500 text-xs">No exports</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {decksTotal > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-ocean-800">
                <span className="text-ocean-400 text-sm">
                  Showing {decksPage * PAGE_SIZE + 1}-
                  {Math.min((decksPage + 1) * PAGE_SIZE, decksTotal)} of {decksTotal}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDecksPage((p) => Math.max(0, p - 1))}
                    disabled={decksPage === 0}
                    className="btn-secondary text-sm py-1 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setDecksPage((p) => p + 1)}
                    disabled={(decksPage + 1) * PAGE_SIZE >= decksTotal}
                    className="btn-secondary text-sm py-1 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Generation History Section (Collapsible) */}
      <div className="card">
        <button
          onClick={() => setGenerationsExpanded(!generationsExpanded)}
          className="w-full flex items-center justify-between mb-4"
        >
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-gold-500" />
            <h2 className="font-display text-xl font-semibold text-white">Generation History</h2>
            <span className="text-ocean-400 text-sm">({generationsTotal} attempts)</span>
          </div>
          {generationsExpanded ? (
            <ChevronUp className="w-5 h-5 text-ocean-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-ocean-400" />
          )}
        </button>

        {generationsExpanded && (
          <>
            {generationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full" />
                <span className="ml-3 text-ocean-400">Loading generation logs...</span>
              </div>
            ) : generationsError ? (
              <div className="text-center py-6">
                <XCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                <p className="text-red-400">{generationsError}</p>
              </div>
            ) : generations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-ocean-400">No generation attempts found matching yer filters.</p>
              </div>
            ) : (
              <>
                {/* Generation List */}
                <div className="space-y-3">
                  {generations.map((gen) => (
                    <div
                      key={gen.id}
                      className={`p-4 rounded-lg border ${
                        gen.success
                          ? 'bg-ocean-900/30 border-ocean-700'
                          : 'bg-red-900/20 border-red-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {gen.success ? (
                              <CheckCircle className="w-5 h-5 text-green-400" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-400" />
                            )}
                            <span
                              className={`font-medium ${gen.success ? 'text-green-400' : 'text-red-400'}`}
                            >
                              {gen.success ? 'Successful Voyage' : 'Failed Attempt'}
                            </span>
                            {gen.model_used && (
                              <span className="text-xs text-ocean-500 bg-ocean-800 px-2 py-0.5 rounded">
                                {gen.model_used}
                              </span>
                            )}
                          </div>
                          <p className="text-ocean-300 text-sm mb-2">
                            {truncateText(gen.prompt, 150)}
                          </p>
                          {!gen.success && gen.error_message && (
                            <div className="mt-2 p-3 bg-red-900/30 rounded border border-red-800/50">
                              <p className="text-red-300 text-sm">
                                <strong>Error:</strong> {gen.error_message}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-ocean-400 text-sm">{formatDate(gen.created_at)}</p>
                          {gen.deck_id && (
                            <p className="text-ocean-500 text-xs mt-1">Deck #{gen.deck_id}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {generationsTotal > PAGE_SIZE && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-ocean-800">
                    <span className="text-ocean-400 text-sm">
                      Showing {generationsPage * PAGE_SIZE + 1}-
                      {Math.min((generationsPage + 1) * PAGE_SIZE, generationsTotal)} of{' '}
                      {generationsTotal}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setGenerationsPage((p) => Math.max(0, p - 1))}
                        disabled={generationsPage === 0}
                        className="btn-secondary text-sm py-1 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setGenerationsPage((p) => p + 1)}
                        disabled={(generationsPage + 1) * PAGE_SIZE >= generationsTotal}
                        className="btn-secondary text-sm py-1 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
