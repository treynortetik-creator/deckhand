import { useState, useEffect, useRef } from 'react';
import { Settings, Palette, FileText, Cpu, Save, Upload, RefreshCw, ExternalLink, Plus, Trash2, Check, Star } from 'lucide-react';
import { brandApi, promptApi, modelsApi, type SystemPrompt, type ModelConfig, type AvailableModels } from '../lib/api';

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
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [availableModels, setAvailableModels] = useState<AvailableModels | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModelType, setAddModelType] = useState<'llm' | 'image'>('llm');
  const [selectedNewModel, setSelectedNewModel] = useState<string>('');

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const [modelsRes, availableRes] = await Promise.all([
        modelsApi.list(),
        modelsApi.available(),
      ]);
      setModels(modelsRes.data);
      setAvailableModels(availableRes.data);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load model configuration' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (model: ModelConfig) => {
    try {
      await modelsApi.update(model.id, { is_default: true });
      setMessage({ type: 'success', text: `Arrr! ${model.display_name} is now the default ${model.model_type} model!` });
      loadModels();
    } catch {
      setMessage({ type: 'error', text: 'Blimey! Failed to set default model.' });
    }
  };

  const handleToggleEnabled = async (model: ModelConfig) => {
    try {
      await modelsApi.update(model.id, { is_enabled: !model.is_enabled });
      loadModels();
    } catch {
      setMessage({ type: 'error', text: 'Blimey! Failed to toggle model.' });
    }
  };

  const handleDelete = async (model: ModelConfig) => {
    if (!confirm(`Are ye sure ye want to delete ${model.display_name}?`)) return;
    try {
      await modelsApi.delete(model.id);
      setMessage({ type: 'success', text: `${model.display_name} has walked the plank!` });
      loadModels();
    } catch {
      setMessage({ type: 'error', text: 'Blimey! Failed to delete model.' });
    }
  };

  const handleSeedModels = async () => {
    setSeeding(true);
    try {
      await modelsApi.seed();
      setMessage({ type: 'success', text: 'Shiver me timbers! Default models seeded!' });
      loadModels();
    } catch {
      setMessage({ type: 'error', text: 'Blimey! Failed to seed models.' });
    } finally {
      setSeeding(false);
    }
  };

  const handleRefreshCache = async () => {
    setRefreshing(true);
    try {
      const response = await modelsApi.refreshCache();
      setMessage({
        type: 'success',
        text: `Models refreshed from OpenRouter! Found ${response.data.llm_count} LLMs and ${response.data.image_count} image models.`
      });
      loadModels();
    } catch {
      setMessage({ type: 'error', text: 'Blimey! Failed to refresh models from OpenRouter.' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddModel = async () => {
    if (!selectedNewModel || !availableModels) return;
    const modelInfo = availableModels[addModelType].find(m => m.model_id === selectedNewModel);
    if (!modelInfo) return;

    try {
      await modelsApi.create({
        model_type: addModelType,
        model_id: modelInfo.model_id,
        display_name: modelInfo.display_name,
        is_default: false,
        is_enabled: true,
      });
      setMessage({ type: 'success', text: `Arrr! ${modelInfo.display_name} added to yer fleet!` });
      setShowAddModal(false);
      setSelectedNewModel('');
      loadModels();
    } catch {
      setMessage({ type: 'error', text: 'Blimey! Failed to add model.' });
    }
  };

  const llmModels = models.filter(m => m.model_type === 'llm');
  const imageModels = models.filter(m => m.model_type === 'image');

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">Model Configuration</h2>
          <p className="text-ocean-400 text-sm">
            Select the AI engines powering yer vessel, ye scallywag
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Model
          </button>
          <button onClick={handleRefreshCache} disabled={refreshing} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh from OpenRouter
          </button>
          <button onClick={handleSeedModels} disabled={seeding} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
            Seed Defaults
          </button>
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

      {/* LLM Models */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-5 h-5 text-ocean-300" />
          <h3 className="font-medium text-white">LLM Models</h3>
          <span className="text-ocean-500 text-sm">(powers content generation)</span>
        </div>
        {llmModels.length === 0 ? (
          <div className="text-center py-8 bg-ocean-900/30 rounded-lg border border-ocean-800">
            <p className="text-ocean-400">No LLM models configured. Click "Seed Defaults" to add some!</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {llmModels.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                onSetDefault={() => handleSetDefault(model)}
                onToggleEnabled={() => handleToggleEnabled(model)}
                onDelete={() => handleDelete(model)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Image Models */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-5 h-5 text-wood-300" />
          <h3 className="font-medium text-white">Image Models</h3>
          <span className="text-ocean-500 text-sm">(creates visual treasures)</span>
        </div>
        {imageModels.length === 0 ? (
          <div className="text-center py-8 bg-ocean-900/30 rounded-lg border border-ocean-800">
            <p className="text-ocean-400">No image models configured. Click "Seed Defaults" to add some!</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {imageModels.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                onSetDefault={() => handleSetDefault(model)}
                onToggleEnabled={() => handleToggleEnabled(model)}
                onDelete={() => handleDelete(model)}
              />
            ))}
          </div>
        )}
      </div>

      {/* OpenRouter Dashboard Link */}
      <div className="border-t border-ocean-700 pt-6">
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
              href="https://openrouter.ai/activity"
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

      {/* Add Model Modal */}
      {showAddModal && availableModels && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-ocean-900 rounded-lg p-6 max-w-md w-full mx-4 border border-ocean-700">
            <h3 className="font-display text-xl font-semibold text-white mb-4">Add Model</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-ocean-200 mb-2">Model Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => { setAddModelType('llm'); setSelectedNewModel(''); }}
                  className={`flex-1 py-2 px-4 rounded-lg border ${
                    addModelType === 'llm'
                      ? 'border-gold-500 bg-gold-500/20 text-gold-400'
                      : 'border-ocean-700 text-ocean-400 hover:border-ocean-600'
                  }`}
                >
                  LLM
                </button>
                <button
                  onClick={() => { setAddModelType('image'); setSelectedNewModel(''); }}
                  className={`flex-1 py-2 px-4 rounded-lg border ${
                    addModelType === 'image'
                      ? 'border-gold-500 bg-gold-500/20 text-gold-400'
                      : 'border-ocean-700 text-ocean-400 hover:border-ocean-600'
                  }`}
                >
                  Image
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-ocean-200 mb-2">Select Model</label>
              <select
                value={selectedNewModel}
                onChange={(e) => setSelectedNewModel(e.target.value)}
                className="input"
              >
                <option value="">Choose a model...</option>
                {availableModels[addModelType].map((model) => (
                  <option key={model.model_id} value={model.model_id}>
                    {model.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowAddModal(false); setSelectedNewModel(''); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAddModel}
                disabled={!selectedNewModel}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />
                Add Model
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModelRow({
  model,
  onSetDefault,
  onToggleEnabled,
  onDelete,
}: {
  model: ModelConfig;
  onSetDefault: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border ${
        model.is_enabled
          ? 'border-ocean-700 bg-ocean-900/30'
          : 'border-ocean-800 bg-ocean-950/50 opacity-60'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{model.display_name}</span>
            {model.is_default && (
              <span className="flex items-center gap-1 text-xs bg-gold-500/20 text-gold-400 px-2 py-0.5 rounded">
                <Star className="w-3 h-3" />
                Default
              </span>
            )}
          </div>
          <code className="text-ocean-500 text-xs font-mono">{model.model_id}</code>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!model.is_default && model.is_enabled && (
          <button
            onClick={onSetDefault}
            className="p-2 text-ocean-400 hover:text-gold-400 hover:bg-ocean-800 rounded-lg transition-colors"
            title="Set as default"
          >
            <Star className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onToggleEnabled}
          className={`p-2 rounded-lg transition-colors ${
            model.is_enabled
              ? 'text-green-400 hover:bg-ocean-800'
              : 'text-ocean-600 hover:bg-ocean-800 hover:text-ocean-400'
          }`}
          title={model.is_enabled ? 'Disable' : 'Enable'}
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-ocean-400 hover:text-red-400 hover:bg-ocean-800 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
