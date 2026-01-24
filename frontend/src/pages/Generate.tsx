import { useState, useEffect } from 'react';
import { Compass, Anchor, Ship, ExternalLink, Download, Loader2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import {
  generateApi,
  templateApi,
  exportApi,
  GenerationRequest,
  GenerationResponse,
  Template,
} from '../lib/api';

// Pirate-themed loading messages for each generation step
const PIRATE_LOADING_MESSAGES = [
  "Charting the waters...",
  "Loading the cannons...",
  "Raising the sails...",
  "Consulting the treasure map...",
  "Summoning the kraken...",
  "Polishing the captain's spyglass...",
  "Swabbing the deck...",
  "Counting the doubloons...",
  "Navigating by the stars...",
  "Hoisting the Jolly Roger...",
  "Battening down the hatches...",
  "Setting course for glory...",
];

type Tone = 'professional' | 'casual' | 'formal' | 'creative';

interface FormState {
  prompt: string;
  templateId: number | null;
  slideCount: number;
  tone: Tone;
}

export function Generate() {
  // Form state
  const [form, setForm] = useState<FormState>({
    prompt: '',
    templateId: null,
    slideCount: 10,
    tone: 'professional',
  });

  // UI state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(PIRATE_LOADING_MESSAGES[0]);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResponse | null>(null);

  // Fetch templates on mount
  useEffect(() => {
    templateApi.list()
      .then(setTemplates)
      .catch((err) => console.error('Failed to fetch templates:', err));
  }, []);

  // Rotate loading messages during generation
  useEffect(() => {
    if (!isLoading) return;

    let messageIndex = 0;

    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % PIRATE_LOADING_MESSAGES.length;
      setLoadingMessage(PIRATE_LOADING_MESSAGES[messageIndex]);
    }, 2500);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Poll for progress during generation
  useEffect(() => {
    if (!isLoading) return;

    const pollProgress = async () => {
      try {
        const progressData = await generateApi.progress();
        setProgress(progressData.progress);
        setCurrentStep(progressData.current_step);

        if (progressData.status === 'completed' && progressData.deck_id) {
          setIsLoading(false);
          // Fetch final result
          setResult({
            id: progressData.deck_id,
            title: 'Your New Deck',
            status: 'completed',
            created_at: new Date().toISOString(),
          });
        } else if (progressData.status === 'failed') {
          setIsLoading(false);
          setError(progressData.error || 'Generation failed. Try again, ye scallywag!');
        }
      } catch {
        // Progress endpoint might not be available yet, continue polling
      }
    };

    const interval = setInterval(pollProgress, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.prompt.trim()) {
      setError('Arrr! Ye need to describe what deck ye want, matey!');
      return;
    }

    setError(null);
    setResult(null);
    setIsLoading(true);
    setProgress(0);
    setCurrentStep('Preparing voyage...');

    try {
      const request: GenerationRequest = {
        prompt: form.prompt,
        slide_count: form.slideCount,
        tone: form.tone,
      };

      if (form.templateId) {
        request.template_id = form.templateId;
      }

      const response = await generateApi.generate(request);
      
      // If we get an immediate response, use it
      if (response.status === 'completed') {
        setIsLoading(false);
        setResult(response);
      }
      // Otherwise, polling will handle the status updates
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Blimey! Something went wrong on the voyage!');
    }
  };

  const handleOpenGoogleSlides = async () => {
    if (!result) return;

    try {
      if (result.google_slides_url) {
        window.open(result.google_slides_url, '_blank');
      } else {
        const response = await exportApi.googleSlides(result.id);
        window.open(response.url, '_blank');
      }
    } catch {
      setError('Failed to open Google Slides. The kraken might be blocking the way!');
    }
  };

  const handleDownloadPptx = () => {
    if (!result) return;
    window.open(exportApi.downloadPptx(result.id), '_blank');
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Page Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold-500/20 mb-4">
            <Compass className="w-8 h-8 text-gold-500" />
          </div>
          <h1 className="font-display text-4xl font-bold text-white mb-3">
            Chart Your Course
          </h1>
          <p className="text-ocean-300 text-lg">
            Describe the deck ye seek, and we'll craft it for ye, captain!
          </p>
        </div>

        {/* Generation Form */}
        {!isLoading && !result && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Prompt Textarea */}
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-ocean-200 mb-2">
                Describe Your Deck
              </label>
              <textarea
                id="prompt"
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                className="input min-h-[150px] resize-y"
                placeholder="Tell us what treasure ye seek... e.g., 'A sales pitch for a new pirate-themed productivity app targeting remote workers'"
              />
            </div>

            {/* Options Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Template Selector */}
              <div>
                <label htmlFor="template" className="block text-sm font-medium text-ocean-200 mb-2">
                  Template (Optional)
                </label>
                <select
                  id="template"
                  value={form.templateId || ''}
                  onChange={(e) => setForm({ ...form, templateId: e.target.value ? Number(e.target.value) : null })}
                  className="input"
                >
                  <option value="">No template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Slide Count Selector */}
              <div>
                <label htmlFor="slideCount" className="block text-sm font-medium text-ocean-200 mb-2">
                  Slide Count
                </label>
                <select
                  id="slideCount"
                  value={form.slideCount}
                  onChange={(e) => setForm({ ...form, slideCount: Number(e.target.value) })}
                  className="input"
                >
                  <option value={5}>5 slides</option>
                  <option value={10}>10 slides</option>
                  <option value={15}>15 slides</option>
                  <option value={20}>20 slides</option>
                </select>
              </div>

              {/* Tone Selector */}
              <div>
                <label htmlFor="tone" className="block text-sm font-medium text-ocean-200 mb-2">
                  Tone
                </label>
                <select
                  id="tone"
                  value={form.tone}
                  onChange={(e) => setForm({ ...form, tone: e.target.value as Tone })}
                  className="input"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                  <option value="creative">Creative</option>
                </select>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-200">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button type="submit" className="btn-primary w-full text-lg py-4">
              <Ship className="w-5 h-5" />
              Set Sail & Generate
            </button>
          </form>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="card text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold-500/20 mb-6">
              <Loader2 className="w-10 h-10 text-gold-500 animate-spin" />
            </div>

            <h2 className="font-display text-2xl font-semibold text-white mb-2">
              {loadingMessage}
            </h2>
            <p className="text-ocean-400 mb-6">
              {currentStep || 'Preparing your voyage...'}
            </p>

            {/* Progress Bar */}
            <div className="max-w-md mx-auto">
              <div className="h-3 bg-ocean-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 text-ocean-400 text-sm">
                {progress}% complete
              </div>
            </div>

            {/* Animated Ship */}
            <div className="mt-8 relative h-12 overflow-hidden">
              <div
                className="absolute transition-all duration-1000 ease-in-out"
                style={{ left: `${Math.min(progress, 90)}%`, transform: 'translateX(-50%)' }}
              >
                <Ship className="w-10 h-10 text-wood-400" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-ocean-700 rounded" />
            </div>
          </div>
        )}

        {/* Result State */}
        {result && (
          <div className="card text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-6">
              <Anchor className="w-10 h-10 text-green-400" />
            </div>

            <h2 className="font-display text-3xl font-bold text-white mb-2">
              Land Ho! Your Deck is Ready!
            </h2>
            <p className="text-ocean-300 text-lg mb-8">
              {result.title}
            </p>

            {/* Export Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <button onClick={handleOpenGoogleSlides} className="btn-primary flex-1">
                <ExternalLink className="w-5 h-5" />
                Open in Google Slides
              </button>
              <button onClick={handleDownloadPptx} className="btn-secondary flex-1">
                <Download className="w-5 h-5" />
                Download PPTX
              </button>
            </div>

            {/* Generate Another */}
            <button
              onClick={() => {
                setResult(null);
                setForm({ ...form, prompt: '' });
              }}
              className="mt-8 text-ocean-300 hover:text-white transition-colors underline"
            >
              Chart another course
            </button>

            {/* Error during export */}
            {error && (
              <div className="mt-6 p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-200">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
