import { useState, useEffect, useRef } from 'react';
import { Settings, Palette, FileText, Cpu, Save, Upload, RefreshCw, ExternalLink, Plus, Trash2, AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { brandApi, promptApi, modelsApi, errorApi, type SystemPrompt, type AvailableModels, type ErrorItem } from '../lib/api';
import { ModelCombobox } from '../components/ModelCombobox';

type TabId = 'brand' | 'prompts' | 'models' | 'errors';

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
  { id: 'errors', label: 'Error Log', icon: AlertTriangle, description: 'Track and manage errors' },
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
        {activeTab === 'errors' && <ErrorLogTab />}
      </div>
    </div>
  );
}

// ============================================================================
// Brand Settings Tab
// ============================================================================

interface ColorEntry {
  label: string;
  value: string;
}

function BrandSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state with proper dict structure
  const [name, setName] = useState('');
  const [primaryColors, setPrimaryColors] = useState<ColorEntry[]>([{ label: 'primary', value: '#d4a828' }]);
  const [secondaryColors, setSecondaryColors] = useState<ColorEntry[]>([{ label: 'secondary', value: '#5a7b87' }]);
  const [fonts, setFonts] = useState({ heading: 'Inter', body: 'Inter' });
  const [guidelinesText, setGuidelinesText] = useState<string | null>(null);

  useEffect(() => {
    loadBrand();
  }, []);

  const loadBrand = async () => {
    try {
      const response = await brandApi.getCurrent();
      const data = response.data;

      setName(data.name || '');

      // Load primary colors from dict
      if (data.primary_colors && Object.keys(data.primary_colors).length > 0) {
        setPrimaryColors(
          Object.entries(data.primary_colors).map(([label, value]) => ({ label, value }))
        );
      }

      // Load secondary colors from dict
      if (data.secondary_colors && Object.keys(data.secondary_colors).length > 0) {
        setSecondaryColors(
          Object.entries(data.secondary_colors).map(([label, value]) => ({ label, value }))
        );
      }

      // Load fonts
      if (data.fonts) {
        setFonts({
          heading: data.fonts.heading || 'Inter',
          body: data.fonts.body || 'Inter',
        });
      }

      setGuidelinesText(data.guidelines_text || null);
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
      // Convert arrays to dicts
      const primaryColorsDict: Record<string, string> = {};
      primaryColors.forEach(c => { primaryColorsDict[c.label] = c.value; });

      const secondaryColorsDict: Record<string, string> = {};
      secondaryColors.forEach(c => { secondaryColorsDict[c.label] = c.value; });

      await brandApi.updateCurrent({
        name,
        primary_colors: primaryColorsDict,
        secondary_colors: secondaryColorsDict,
        fonts,
      });
      setMessage({ type: 'success', text: 'Arrr! Brand settings saved successfully!' });
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
      const response = await brandApi.uploadPdf(file);
      const data = response.data;

      // Count extracted items for feedback
      const primaryCount = data.primary_colors ? Object.keys(data.primary_colors).length : 0;
      const secondaryCount = data.secondary_colors ? Object.keys(data.secondary_colors).length : 0;
      const fontCount = data.fonts ? Object.keys(data.fonts).filter(k => data.fonts![k]).length : 0;

      setMessage({
        type: 'success',
        text: `Shiver me timbers! Extracted ${primaryCount + secondaryCount} colors and ${fontCount} fonts from yer PDF!`
      });

      // Reload to show extracted data
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

  // Color management functions
  const addColor = (type: 'primary' | 'secondary') => {
    const newLabel = type === 'primary' ? `color${primaryColors.length + 1}` : `color${secondaryColors.length + 1}`;
    const newColor = { label: newLabel, value: '#888888' };
    if (type === 'primary') {
      setPrimaryColors([...primaryColors, newColor]);
    } else {
      setSecondaryColors([...secondaryColors, newColor]);
    }
  };

  const removeColor = (type: 'primary' | 'secondary', index: number) => {
    if (type === 'primary') {
      if (primaryColors.length > 1) {
        setPrimaryColors(primaryColors.filter((_, i) => i !== index));
      }
    } else {
      setSecondaryColors(secondaryColors.filter((_, i) => i !== index));
    }
  };

  const updateColor = (type: 'primary' | 'secondary', index: number, field: 'label' | 'value', newValue: string) => {
    if (type === 'primary') {
      const updated = [...primaryColors];
      updated[index] = { ...updated[index], [field]: newValue };
      setPrimaryColors(updated);
    } else {
      const updated = [...secondaryColors];
      updated[index] = { ...updated[index], [field]: newValue };
      setSecondaryColors(updated);
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

      {/* Brand Name */}
      <div>
        <label className="block text-sm font-medium text-ocean-200 mb-2">Brand Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter yer brand name"
          className="input max-w-md"
        />
      </div>

      {/* Fonts */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ocean-200 mb-2">Heading Font</label>
          <input
            type="text"
            value={fonts.heading}
            onChange={(e) => setFonts({ ...fonts, heading: e.target.value })}
            placeholder="e.g., Playfair Display"
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ocean-200 mb-2">Body Font</label>
          <input
            type="text"
            value={fonts.body}
            onChange={(e) => setFonts({ ...fonts, body: e.target.value })}
            placeholder="e.g., Inter"
            className="input"
          />
        </div>
      </div>

      {/* Primary Colors */}
      <div className="border-t border-ocean-700 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-white">Primary Colors</h3>
            <p className="text-ocean-400 text-sm">Main brand colors used for headings and accents</p>
          </div>
          <button onClick={() => addColor('primary')} className="btn-secondary text-sm py-2 px-3">
            <Plus className="w-4 h-4" />
            Add Color
          </button>
        </div>
        <div className="space-y-3">
          {primaryColors.map((color, index) => (
            <div key={index} className="flex gap-3 items-center">
              <input
                type="color"
                value={color.value}
                onChange={(e) => updateColor('primary', index, 'value', e.target.value)}
                className="w-12 h-10 rounded-lg cursor-pointer border border-ocean-700 bg-transparent"
              />
              <input
                type="text"
                value={color.value}
                onChange={(e) => updateColor('primary', index, 'value', e.target.value)}
                className="input w-32"
                placeholder="#hex"
              />
              <input
                type="text"
                value={color.label}
                onChange={(e) => updateColor('primary', index, 'label', e.target.value)}
                className="input flex-1"
                placeholder="Label (e.g., primary, accent)"
              />
              {primaryColors.length > 1 && (
                <button
                  onClick={() => removeColor('primary', index)}
                  className="p-2 text-ocean-400 hover:text-red-400 hover:bg-ocean-800 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Secondary Colors */}
      <div className="border-t border-ocean-700 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-white">Secondary Colors</h3>
            <p className="text-ocean-400 text-sm">Supporting colors for backgrounds and body text</p>
          </div>
          <button onClick={() => addColor('secondary')} className="btn-secondary text-sm py-2 px-3">
            <Plus className="w-4 h-4" />
            Add Color
          </button>
        </div>
        <div className="space-y-3">
          {secondaryColors.map((color, index) => (
            <div key={index} className="flex gap-3 items-center">
              <input
                type="color"
                value={color.value}
                onChange={(e) => updateColor('secondary', index, 'value', e.target.value)}
                className="w-12 h-10 rounded-lg cursor-pointer border border-ocean-700 bg-transparent"
              />
              <input
                type="text"
                value={color.value}
                onChange={(e) => updateColor('secondary', index, 'value', e.target.value)}
                className="input w-32"
                placeholder="#hex"
              />
              <input
                type="text"
                value={color.label}
                onChange={(e) => updateColor('secondary', index, 'label', e.target.value)}
                className="input flex-1"
                placeholder="Label (e.g., background, text)"
              />
              <button
                onClick={() => removeColor('secondary', index)}
                className="p-2 text-ocean-400 hover:text-red-400 hover:bg-ocean-800 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {secondaryColors.length === 0 && (
            <p className="text-ocean-500 text-sm italic">No secondary colors. Click "Add Color" to add one.</p>
          )}
        </div>
      </div>

      {/* Guidelines Text (if extracted) */}
      {guidelinesText && (
        <div className="border-t border-ocean-700 pt-6">
          <details className="group">
            <summary className="cursor-pointer flex items-center gap-2 text-ocean-200 hover:text-white">
              <FileText className="w-4 h-4" />
              <span className="font-medium">Extracted Guidelines Text</span>
              <span className="text-ocean-500 text-sm ml-2">({guidelinesText.length} characters)</span>
            </summary>
            <div className="mt-3 p-4 bg-ocean-900/50 rounded-lg border border-ocean-800 max-h-48 overflow-y-auto">
              <pre className="text-ocean-300 text-xs whitespace-pre-wrap font-mono">{guidelinesText}</pre>
            </div>
          </details>
        </div>
      )}

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

interface AgentModels {
  outline: { agent_type: string; model_id: string; display_name: string } | null;
  content: { agent_type: string; model_id: string; display_name: string } | null;
  image: { agent_type: string; model_id: string; display_name: string } | null;
}

function ModelConfigTab() {
  const [availableModels, setAvailableModels] = useState<AvailableModels | null>(null);
  const [agentModels, setAgentModels] = useState<AgentModels | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const [availableRes, agentsRes] = await Promise.all([
        modelsApi.available(),
        modelsApi.getAgents(),
      ]);
      setAvailableModels(availableRes.data);
      setAgentModels(agentsRes.data);
    } catch (err) {
      console.error('Failed to load model configuration:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'error', text: `Failed to load model configuration: ${errorMsg}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSetAgentModel = async (agentType: 'outline' | 'content' | 'image', modelId: string) => {
    try {
      await modelsApi.setAgentModel(agentType, modelId);
      setMessage({ type: 'success', text: `Arrr! ${agentType} agent model updated!` });
      loadModels();
    } catch {
      setMessage({ type: 'error', text: 'Blimey! Failed to update agent model.' });
    }
  };

  const handleRefreshCache = async () => {
    setRefreshing(true);
    try {
      const response = await modelsApi.refreshCache();
      setMessage({
        type: 'success',
        text: `Models refreshed from OpenRouter! Found ${response.data.llm_count} LLMs.`
      });
      loadModels();
    } catch {
      setMessage({ type: 'error', text: 'Blimey! Failed to refresh models from OpenRouter.' });
    } finally {
      setRefreshing(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">Model Configuration</h2>
          <p className="text-ocean-400 text-sm">
            Assign AI models to each agent in the generation pipeline
          </p>
        </div>
        <button onClick={handleRefreshCache} disabled={refreshing} className="btn-secondary">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh from OpenRouter
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

      {/* Agent Configuration */}
      <div>
        <div className="mb-4">
          <p className="text-ocean-400 text-sm">
            Select a model for each agent from the {availableModels?.llm?.length || 0} available OpenRouter models
          </p>
        </div>
        <div className="space-y-4">
          {/* Outline Agent */}
          <div className="border border-ocean-700 rounded-lg p-4 bg-ocean-900/30">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-shrink-0">
                <h4 className="font-medium text-white">Outline Agent</h4>
                <p className="text-ocean-500 text-sm">Plans deck structure and slide flow (temp 0.7)</p>
              </div>
              <div className="w-80">
                <ModelCombobox
                  models={availableModels?.llm || []}
                  value={agentModels?.outline?.model_id || 'default'}
                  onChange={(modelId) => handleSetAgentModel('outline', modelId)}
                  placeholder="Search LLM models..."
                  allowDefault
                  defaultLabel="Use Default LLM"
                />
              </div>
            </div>
          </div>

          {/* Content Agent */}
          <div className="border border-ocean-700 rounded-lg p-4 bg-ocean-900/30">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-shrink-0">
                <h4 className="font-medium text-white">Content Agent</h4>
                <p className="text-ocean-500 text-sm">Enhances slide content in parallel (temp 0.6)</p>
              </div>
              <div className="w-80">
                <ModelCombobox
                  models={availableModels?.llm || []}
                  value={agentModels?.content?.model_id || 'default'}
                  onChange={(modelId) => handleSetAgentModel('content', modelId)}
                  placeholder="Search LLM models..."
                  allowDefault
                  defaultLabel="Use Default LLM"
                />
              </div>
            </div>
          </div>

          {/* Image Agent */}
          <div className="border border-ocean-700 rounded-lg p-4 bg-ocean-900/30">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-shrink-0">
                <h4 className="font-medium text-white">Image Agent</h4>
                <p className="text-ocean-500 text-sm">Generates visual assets for slides</p>
              </div>
              <div className="w-80">
                <ModelCombobox
                  models={availableModels?.llm || []}
                  value={agentModels?.image?.model_id || 'default'}
                  onChange={(modelId) => handleSetAgentModel('image', modelId)}
                  placeholder="Search models..."
                  allowDefault
                  defaultLabel="Use Default Image Model"
                />
              </div>
            </div>
          </div>
        </div>
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

    </div>
  );
}

// ============================================================================
// Error Log Tab
// ============================================================================

function ErrorLogTab() {
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [showResolved, setShowResolved] = useState<boolean | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesText, setNotesText] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [clearing, setClearing] = useState(false);
  const PAGE_SIZE = 15;

  useEffect(() => {
    loadErrors();
  }, [page, showResolved]);

  const loadErrors = async () => {
    setLoading(true);
    try {
      const response = await errorApi.list({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        resolved: showResolved ?? undefined,
      });
      setErrors(response.data.errors);
      setTotal(response.data.total);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load errors' });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkResolved = async (errorId: number, resolved: boolean) => {
    try {
      await errorApi.update(errorId, { resolved });
      setMessage({ type: 'success', text: resolved ? 'Error marked as resolved' : 'Error marked as unresolved' });
      loadErrors();
    } catch {
      setMessage({ type: 'error', text: 'Failed to update error' });
    }
  };

  const handleSaveNotes = async (errorId: number) => {
    try {
      await errorApi.update(errorId, { notes: notesText });
      setMessage({ type: 'success', text: 'Notes saved' });
      setEditingNotes(null);
      loadErrors();
    } catch {
      setMessage({ type: 'error', text: 'Failed to save notes' });
    }
  };

  const handleDelete = async (errorId: number) => {
    if (!confirm('Are ye sure ye want to delete this error log?')) return;
    try {
      await errorApi.delete(errorId);
      setMessage({ type: 'success', text: 'Error deleted' });
      loadErrors();
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete error' });
    }
  };

  const handleClearResolved = async () => {
    if (!confirm('This will permanently delete ALL resolved errors. Are ye sure, matey?')) return;
    setClearing(true);
    try {
      const response = await errorApi.clearResolved();
      setMessage({ type: 'success', text: `Cleared ${response.data.deleted_count} resolved errors` });
      loadErrors();
    } catch {
      setMessage({ type: 'error', text: 'Failed to clear resolved errors' });
    } finally {
      setClearing(false);
    }
  };

  const toggleExpand = (errorId: number) => {
    if (expandedId === errorId) {
      setExpandedId(null);
    } else {
      setExpandedId(errorId);
      const error = errors.find(e => e.id === errorId);
      setNotesText(error?.notes || '');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncateMessage = (message: string, maxLength = 80) => {
    return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading && errors.length === 0) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-8 h-8 text-ocean-400 animate-spin mx-auto mb-4" />
        <p className="text-ocean-400">Loading error log...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">Error Log</h2>
          <p className="text-ocean-400 text-sm">
            Track and manage application errors ({total} total)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleClearResolved}
            disabled={clearing}
            className="btn-secondary text-red-400 hover:text-red-300"
          >
            {clearing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Clear Resolved
              </>
            )}
          </button>
          <button onClick={loadErrors} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
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

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowResolved(null); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            showResolved === null
              ? 'bg-gold-500/20 text-gold-500 border border-gold-500/50'
              : 'text-ocean-300 hover:text-white hover:bg-ocean-800/50'
          }`}
        >
          All
        </button>
        <button
          onClick={() => { setShowResolved(false); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            showResolved === false
              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
              : 'text-ocean-300 hover:text-white hover:bg-ocean-800/50'
          }`}
        >
          Unresolved
        </button>
        <button
          onClick={() => { setShowResolved(true); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            showResolved === true
              ? 'bg-green-500/20 text-green-400 border border-green-500/50'
              : 'text-ocean-300 hover:text-white hover:bg-ocean-800/50'
          }`}
        >
          Resolved
        </button>
      </div>

      {/* Error List */}
      {errors.length === 0 ? (
        <div className="text-center py-12 bg-ocean-900/50 rounded-lg border border-ocean-800">
          <AlertTriangle className="w-12 h-12 text-ocean-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Errors Found</h3>
          <p className="text-ocean-400">
            {showResolved === false
              ? 'No unresolved errors. Smooth sailing!'
              : showResolved === true
              ? 'No resolved errors in the log.'
              : 'The error log be empty. Smooth sailing ahead!'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {errors.map((error) => (
            <div
              key={error.id}
              className={`border rounded-lg overflow-hidden transition-all ${
                error.resolved
                  ? 'border-ocean-800 bg-ocean-900/30'
                  : 'border-red-900/50 bg-red-950/20'
              }`}
            >
              {/* Error Row */}
              <div
                onClick={() => toggleExpand(error.id)}
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-ocean-800/30"
              >
                <div className="flex-shrink-0">
                  {expandedId === error.id ? (
                    <ChevronDown className="w-4 h-4 text-ocean-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-ocean-400" />
                  )}
                </div>
                <div className="flex-shrink-0 w-40 text-ocean-400 text-sm">
                  {formatTimestamp(error.timestamp)}
                </div>
                <div className="flex-shrink-0 w-24">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    error.method === 'GET' ? 'bg-blue-500/20 text-blue-400' :
                    error.method === 'POST' ? 'bg-green-500/20 text-green-400' :
                    error.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {error.method}
                  </span>
                </div>
                <div className="flex-shrink-0 w-48 text-ocean-300 text-sm font-mono truncate">
                  {error.endpoint}
                </div>
                <div className="flex-shrink-0 w-32 text-ocean-300 text-sm truncate">
                  {error.error_type}
                </div>
                <div className="flex-1 text-ocean-400 text-sm truncate">
                  {truncateMessage(error.error_message)}
                </div>
                <div className="flex-shrink-0">
                  {error.resolved ? (
                    <span className="flex items-center gap-1 text-green-400 text-xs">
                      <Check className="w-3 h-3" />
                      Resolved
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-400 text-xs">
                      <AlertTriangle className="w-3 h-3" />
                      Open
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === error.id && (
                <div className="border-t border-ocean-800 p-4 bg-ocean-900/50 space-y-4">
                  {/* Full Error Message */}
                  <div>
                    <h4 className="text-sm font-medium text-ocean-200 mb-2">Error Message</h4>
                    <p className="text-ocean-300 text-sm bg-ocean-950/50 p-3 rounded-lg">
                      {error.error_message}
                    </p>
                  </div>

                  {/* Traceback */}
                  {error.traceback && (
                    <div>
                      <h4 className="text-sm font-medium text-ocean-200 mb-2">Traceback</h4>
                      <pre className="text-ocean-400 text-xs bg-ocean-950/50 p-3 rounded-lg overflow-x-auto max-h-64 overflow-y-auto font-mono">
                        {error.traceback}
                      </pre>
                    </div>
                  )}

                  {/* Request Body */}
                  {error.request_body && (
                    <div>
                      <h4 className="text-sm font-medium text-ocean-200 mb-2">Request Body</h4>
                      <pre className="text-ocean-400 text-xs bg-ocean-950/50 p-3 rounded-lg overflow-x-auto max-h-32 overflow-y-auto font-mono">
                        {JSON.stringify(error.request_body, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <h4 className="text-sm font-medium text-ocean-200 mb-2">Notes</h4>
                    {editingNotes === error.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={notesText}
                          onChange={(e) => setNotesText(e.target.value)}
                          className="input resize-y text-sm"
                          rows={3}
                          placeholder="Add notes about this error..."
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveNotes(error.id)}
                            className="btn-primary text-sm py-1.5 px-3"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                          <button
                            onClick={() => setEditingNotes(null)}
                            className="btn-secondary text-sm py-1.5 px-3"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => { setEditingNotes(error.id); setNotesText(error.notes || ''); }}
                        className="text-ocean-400 text-sm bg-ocean-950/50 p-3 rounded-lg cursor-pointer hover:bg-ocean-950/70 min-h-[60px]"
                      >
                        {error.notes || <span className="text-ocean-600 italic">Click to add notes...</span>}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-ocean-800">
                    <button
                      onClick={() => handleMarkResolved(error.id, !error.resolved)}
                      className={`text-sm py-1.5 px-3 rounded-lg flex items-center gap-1.5 ${
                        error.resolved
                          ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      {error.resolved ? 'Mark Unresolved' : 'Mark Resolved'}
                    </button>
                    <button
                      onClick={() => handleDelete(error.id)}
                      className="text-sm py-1.5 px-3 rounded-lg flex items-center gap-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-ocean-700">
          <p className="text-ocean-400 text-sm">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
