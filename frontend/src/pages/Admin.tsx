import { useState, useEffect, useRef } from 'react';
import { Settings, Palette, FileText, Cpu, Save, Upload, RefreshCw, ExternalLink } from 'lucide-react';
import { brandApi, promptApi, configApi, type SystemPrompt, type ModelConfig } from '../lib/api';

type TabId = 'brand' | 'prompts' | 'models';

interface TabConfig {
  id: TabId;
  label: string;
  icon: typeof Settings;
  description: string;
}

const tabs: TabConfig[] = [
  { id: 'brand', label: 'Brand Settings', icon: Palette, description: "Yer ship's colors and identity" },
  { id: 'prompts', label: 'System Prompts', icon: FileText, description: "The crew's orders and instructions" },
  { id: 'models', label: 'Model Configuration', icon: Cpu, description: 'The engines powering yer vessel' },
];

export default function Admin() {
  const [activeTab, setActiveTab] = useState<TabId>('brand');

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-lg bg-ocean-600/30 flex items-center justify-center">
          <Settings className="w-6 h-6 text-ocean-300" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Captain's Quarters</h1>
          <p className="text-ocean-400">Ship settings and crew management, ye scurvy dog</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-ocean-700 pb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-gold-500/20 text-gold-500 border border-gold-500/50'
                  : 'text-ocean-300 hover:text-white hover:bg-ocean-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'brand' && <BrandSettingsTab />}
        {activeTab === 'prompts' && <SystemPromptsTab />}
        {activeTab === 'models' && <ModelConfigTab />}
      </div>
    </div>
  );
}

// ============================================================================
// Brand Settings Tab
// ============================================================================

function BrandSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    primary_color: '#d4a828',
    secondary_color: '#0091c3',
    font_family: 'Inter',
  });

  useEffect(() => {
    loadBrand();
  }, []);

  const loadBrand = async () => {
    try {
      const response = await brandApi.getCurrent();
      setFormData({
        name: response.data.name || '',
        description: response.data.description || '',
        primary_color: response.data.primary_color || '#d4a828',
        secondary_color: response.data.secondary_color || '#0091c3',
        font_family: response.data.font_family || 'Inter',
      });
    } catch {
      // No brand configured yet - use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await brandApi.updateCurrent(formData);
      setMessage({ type: 'success', text: 'Arrr! Brand settings saved successfully!' });
      loadBrand();
    } catch {
      setMessage({ type: 'error', text: 'Blimey! Failed to save brand settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setMessage({ type: 'error', text: 'Walk the plank! Only PDF files be accepted.' });
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      await brandApi.uploadPdf(file);
      setMessage({ type: 'success', text: 'Shiver me timbers! Brand PDF uploaded and processed!' });
      loadBrand();
    } catch {
      setMessage({ type: 'error', text: 'Blimey! Failed to upload brand PDF.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-8 h-8 text-ocean-400 animate-spin mx-auto mb-4" />
        <p className="text-ocean-400">Loading brand settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">Brand Settings</h2>
          <p className="text-ocean-400 text-sm">
            Configure yer ship's colors and identity, matey
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-500/20 border border-green-500/50 text-green-300'
              : 'bg-red-500/20 border border-red-500/50 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Brand Info */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ocean-200 mb-2">Brand Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter yer brand name"
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ocean-200 mb-2">Font Family</label>
          <input
            type="text"
            value={formData.font_family}
            onChange={(e) => setFormData({ ...formData, font_family: e.target.value })}
            placeholder="e.g., Inter, Playfair Display"
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ocean-200 mb-2">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Tell us about yer brand, ye sea dog..."
          rows={3}
          className="input resize-none"
        />
      </div>

      {/* Color Pickers */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ocean-200 mb-2">Primary Color</label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={formData.primary_color}
              onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
              className="w-12 h-12 rounded-lg cursor-pointer border border-ocean-700 bg-transparent"
            />
            <input
              type="text"
              value={formData.primary_color}
              onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
              className="input flex-1"
              placeholder="#d4a828"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-ocean-200 mb-2">Secondary Color</label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={formData.secondary_color}
              onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
              className="w-12 h-12 rounded-lg cursor-pointer border border-ocean-700 bg-transparent"
            />
            <input
              type="text"
              value={formData.secondary_color}
              onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
              className="input flex-1"
              placeholder="#0091c3"
            />
          </div>
        </div>
      </div>

      {/* PDF Upload */}
      <div className="border-t border-ocean-700 pt-6">
        <h3 className="font-display text-lg font-semibold text-white mb-2">Brand Guidelines PDF</h3>
        <p className="text-ocean-400 text-sm mb-4">
          Upload yer brand guidelines PDF to auto-extract colors, fonts, and style preferences
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handlePdfUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary"
        >
          {uploading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload Brand PDF
            </>
          )}
        </button>
      </div>

      {/* Save Button */}
      <div className="flex justify-end border-t border-ocean-700 pt-6">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Brand Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// System Prompts Tab
// ============================================================================

const PROMPT_DESCRIPTIONS: Record<string, string> = {
  deck_generation: 'Controls how deck content is structured and generated',
  content_agent: 'Guides the content refinement and improvement process',
  image_generation: 'Defines how image prompts are crafted for visuals',
};

function SystemPromptsTab() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPrompt, setSavingPrompt] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const response = await promptApi.listSystem();
      setPrompts(response.data);
      // Initialize edited prompts with current values
      const initial: Record<string, string> = {};
      response.data.forEach((p) => {
        initial[p.name] = p.prompt_text;
      });
      setEditedPrompts(initial);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load system prompts' });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrompt = async (name: string) => {
    setSavingPrompt(name);
    setMessage(null);
    try {
      await promptApi.updateSystem(name, editedPrompts[name] || '');
      setMessage({ type: 'success', text: `Arrr! "${name}" prompt saved successfully!` });
      loadPrompts();
    } catch {
      setMessage({ type: 'error', text: `Blimey! Failed to save "${name}" prompt.` });
    } finally {
      setSavingPrompt(null);
    }
  };

  const handleSeedDefaults = async () => {
    if (!confirm('This will reset all prompts to their default values. Are ye sure, matey?')) {
      return;
    }
    setSeeding(true);
    setMessage(null);
    try {
      await promptApi.seedSystem();
      setMessage({ type: 'success', text: 'Shiver me timbers! Default prompts restored!' });
      loadPrompts();
    } catch {
      setMessage({ type: 'error', text: 'Blimey! Failed to seed default prompts.' });
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-8 h-8 text-ocean-400 animate-spin mx-auto mb-4" />
        <p className="text-ocean-400">Loading system prompts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">System Prompts</h2>
          <p className="text-ocean-400 text-sm">
            Configure the AI crew's standing orders, ye landlubber
          </p>
        </div>
        <button onClick={handleSeedDefaults} disabled={seeding} className="btn-secondary">
          {seeding ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Seeding...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Seed Defaults
            </>
          )}
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-500/20 border border-green-500/50 text-green-300'
              : 'bg-red-500/20 border border-red-500/50 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {prompts.length === 0 ? (
        <div className="text-center py-12 bg-ocean-900/50 rounded-lg border border-ocean-800">
          <FileText className="w-12 h-12 text-ocean-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Prompts Found</h3>
          <p className="text-ocean-400 mb-4">
            The crew has no standing orders. Seed the defaults to get started!
          </p>
          <button onClick={handleSeedDefaults} disabled={seeding} className="btn-primary">
            <RefreshCw className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
            Seed Default Prompts
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {prompts.map((prompt) => (
            <div key={prompt.name} className="border border-ocean-700 rounded-lg p-4 bg-ocean-900/30">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-white">{prompt.name}</h3>
                  <p className="text-ocean-400 text-sm">
                    {PROMPT_DESCRIPTIONS[prompt.name] || prompt.description || 'System prompt'}
                  </p>
                </div>
                <button
                  onClick={() => handleSavePrompt(prompt.name)}
                  disabled={savingPrompt === prompt.name}
                  className="btn-primary text-sm py-2 px-3"
                >
                  {savingPrompt === prompt.name ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3" />
                      Save
                    </>
                  )}
                </button>
              </div>
              <textarea
                value={editedPrompts[prompt.name] || ''}
                onChange={(e) =>
                  setEditedPrompts({ ...editedPrompts, [prompt.name]: e.target.value })
                }
                rows={8}
                className="input resize-y font-mono text-sm"
                placeholder="Enter prompt text..."
              />
              {prompt.updated_at && (
                <p className="text-ocean-500 text-xs mt-2">
                  Last updated: {new Date(prompt.updated_at).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Model Configuration Tab
// ============================================================================

function ModelConfigTab() {
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await configApi.getModels();
      setConfig(response.data);
    } catch {
      // Use fallback defaults if API not available
      setConfig({
        llm_model: 'anthropic/claude-sonnet-4-20250514',
        image_model: 'openai/dall-e-3',
        openrouter_dashboard_url: 'https://openrouter.ai/activity',
      });
      setError('Could not fetch live config - showing defaults');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-8 h-8 text-ocean-400 animate-spin mx-auto mb-4" />
        <p className="text-ocean-400">Loading model configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">Model Configuration</h2>
        <p className="text-ocean-400 text-sm">
          The engines powering yer vessel (read-only for now, ye scallywag)
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-yellow-500/20 border border-yellow-500/50 text-yellow-300">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {/* LLM Model */}
        <div className="border border-ocean-700 rounded-lg p-4 bg-ocean-900/30">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-ocean-600/30 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-ocean-300" />
            </div>
            <div>
              <h3 className="font-medium text-white">LLM Model</h3>
              <p className="text-ocean-400 text-sm">Powers deck content generation</p>
            </div>
          </div>
          <div className="bg-ocean-950 rounded-lg p-3 mt-3">
            <code className="text-gold-400 font-mono text-sm">{config?.llm_model || 'Not configured'}</code>
          </div>
        </div>

        {/* Image Model */}
        <div className="border border-ocean-700 rounded-lg p-4 bg-ocean-900/30">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-wood-600/30 flex items-center justify-center">
              <Palette className="w-5 h-5 text-wood-300" />
            </div>
            <div>
              <h3 className="font-medium text-white">Image Model</h3>
              <p className="text-ocean-400 text-sm">Creates visual treasures for yer decks</p>
            </div>
          </div>
          <div className="bg-ocean-950 rounded-lg p-3 mt-3">
            <code className="text-gold-400 font-mono text-sm">{config?.image_model || 'Not configured'}</code>
          </div>
        </div>

        {/* OpenRouter Dashboard Link */}
        <div className="border border-ocean-700 rounded-lg p-4 bg-ocean-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold-500/20 flex items-center justify-center">
                <ExternalLink className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">OpenRouter Dashboard</h3>
                <p className="text-ocean-400 text-sm">View usage stats and manage yer API keys</p>
              </div>
            </div>
            <a
              href={config?.openrouter_dashboard_url || 'https://openrouter.ai/activity'}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              <ExternalLink className="w-4 h-4" />
              Open Dashboard
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-ocean-700 pt-6">
        <p className="text-ocean-500 text-sm">
          To change model configuration, update the environment variables on yer server and restart
          the engines. Contact yer ship's engineer (backend admin) for assistance.
        </p>
      </div>
    </div>
  );
}
