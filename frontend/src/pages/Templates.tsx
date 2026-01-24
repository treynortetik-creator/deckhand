import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Trash2,
  Edit,
  ChevronUp,
  ChevronDown,
  Layers,
  Compass,
  X,
  Anchor,
  Loader2,
} from 'lucide-react';
import {
  templateApi,
  type Template,
  type SlideDefinition,
  type TemplateCreate,
} from '../lib/api';

// Slide type options with pirate-themed labels
const SLIDE_TYPES: { value: SlideDefinition['type']; label: string; icon: string }[] = [
  { value: 'title', label: 'Title Slide (The Captain)', icon: 'T' },
  { value: 'content', label: 'Content (The Cargo)', icon: 'C' },
  { value: 'image', label: 'Image (Treasure Map)', icon: 'I' },
  { value: 'two-column', label: 'Two Columns (Port & Starboard)', icon: '||' },
  { value: 'quote', label: 'Quote (Sea Shanty)', icon: 'Q' },
];

// Available placeholders
const AVAILABLE_PLACEHOLDERS = [
  'title',
  'subtitle',
  'body',
  'bullet_points',
  'image',
  'caption',
  'quote',
  'author',
  'left_column',
  'right_column',
];

// Helper to get slide type label
const getSlideTypeLabel = (type: string): string => {
  const found = SLIDE_TYPES.find((t) => t.value === type);
  return found ? found.label : type;
};

// Helper to get slide type icon
const getSlideTypeIcon = (type: string): string => {
  const found = SLIDE_TYPES.find((t) => t.value === type);
  return found ? found.icon : '?';
};

// Slide Preview Component - visual diagram of slide structure
function SlidePreview({ slides }: { slides: SlideDefinition[] }) {
  if (!slides || slides.length === 0) {
    return (
      <div className="flex items-center gap-1 text-ocean-500 text-sm">
        <Layers className="w-4 h-4" />
        <span>No slides defined</span>
      </div>
    );
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {slides.slice(0, 8).map((slide, index) => (
        <div
          key={index}
          className="w-8 h-6 rounded bg-ocean-700/50 border border-ocean-600 flex items-center justify-center text-xs text-ocean-300 font-mono"
          title={`${index + 1}. ${getSlideTypeLabel(slide.type)}`}
        >
          {getSlideTypeIcon(slide.type)}
        </div>
      ))}
      {slides.length > 8 && (
        <div className="w-8 h-6 rounded bg-ocean-800/50 border border-ocean-700 flex items-center justify-center text-xs text-ocean-400">
          +{slides.length - 8}
        </div>
      )}
    </div>
  );
}

// Template Card Component
function TemplateCard({
  template,
  onUse,
  onEdit,
  onDelete,
}: {
  template: Template;
  onUse: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="card group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-ocean-600/30 flex items-center justify-center">
            <FileText className="w-5 h-5 text-ocean-300" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-white">{template.name}</h3>
            <p className="text-ocean-400 text-sm">
              {template.slide_structure?.length || 0} slides
            </p>
          </div>
        </div>
      </div>

      {template.description && (
        <p className="text-ocean-300 text-sm mb-4 line-clamp-2">{template.description}</p>
      )}

      {/* Slide Structure Preview */}
      <div className="mb-4">
        <SlidePreview slides={template.slide_structure || []} />
      </div>

      {/* Actions */}
      {showDeleteConfirm ? (
        <div className="flex items-center gap-2 p-3 bg-red-900/20 rounded-lg border border-red-700/50">
          <span className="text-red-200 text-sm flex-1">Walk the plank?</span>
          <button
            onClick={() => {
              onDelete();
              setShowDeleteConfirm(false);
            }}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-500 transition-colors"
          >
            Aye!
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-3 py-1 bg-ocean-700 text-ocean-200 rounded text-sm hover:bg-ocean-600 transition-colors"
          >
            Nay
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={onUse} className="btn-primary flex-1 py-2 text-sm">
            <Compass className="w-4 h-4" />
            Set Sail
          </button>
          <button
            onClick={onEdit}
            className="p-2 bg-ocean-700/50 text-ocean-300 rounded-lg hover:bg-ocean-600/50 hover:text-white transition-colors"
            title="Edit template"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 bg-ocean-700/50 text-ocean-300 rounded-lg hover:bg-red-600/50 hover:text-red-200 transition-colors"
            title="Delete template"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// Slide Structure Builder Component
function SlideStructureBuilder({
  slides,
  onChange,
}: {
  slides: SlideDefinition[];
  onChange: (slides: SlideDefinition[]) => void;
}) {
  const addSlide = () => {
    onChange([...slides, { type: 'content', placeholders: ['title', 'body'] }]);
  };

  const removeSlide = (index: number) => {
    onChange(slides.filter((_, i) => i !== index));
  };

  const updateSlide = (index: number, updates: Partial<SlideDefinition>) => {
    onChange(slides.map((slide, i) => (i === index ? { ...slide, ...updates } : slide)));
  };

  const moveSlide = (index: number, direction: 'up' | 'down') => {
    const newSlides = [...slides];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slides.length) return;
    [newSlides[index], newSlides[newIndex]] = [newSlides[newIndex], newSlides[index]];
    onChange(newSlides);
  };

  const togglePlaceholder = (slideIndex: number, placeholder: string) => {
    const slide = slides[slideIndex];
    const newPlaceholders = slide.placeholders.includes(placeholder)
      ? slide.placeholders.filter((p) => p !== placeholder)
      : [...slide.placeholders, placeholder];
    updateSlide(slideIndex, { placeholders: newPlaceholders });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-ocean-200">Slide Structure</label>
        <button
          type="button"
          onClick={addSlide}
          className="flex items-center gap-1 text-sm text-gold-500 hover:text-gold-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Slide
        </button>
      </div>

      {slides.length === 0 ? (
        <div className="p-6 rounded-lg bg-ocean-900/50 border border-ocean-700 border-dashed text-center">
          <Layers className="w-8 h-8 text-ocean-600 mx-auto mb-2" />
          <p className="text-ocean-400 text-sm">No slides yet. Add some to build yer deck!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map((slide, index) => (
            <div
              key={index}
              className="p-4 rounded-lg bg-ocean-900/50 border border-ocean-700 space-y-3"
            >
              <div className="flex items-center gap-3">
                {/* Slide Number */}
                <div className="w-8 h-8 rounded-full bg-ocean-700 flex items-center justify-center text-sm font-semibold text-ocean-200">
                  {index + 1}
                </div>

                {/* Slide Type Dropdown */}
                <select
                  value={slide.type}
                  onChange={(e) =>
                    updateSlide(index, { type: e.target.value as SlideDefinition['type'] })
                  }
                  className="input flex-1 py-2"
                >
                  {SLIDE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>

                {/* Move Buttons */}
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moveSlide(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-ocean-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSlide(index, 'down')}
                    disabled={index === slides.length - 1}
                    className="p-1 text-ocean-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => removeSlide(index)}
                  className="p-2 text-ocean-400 hover:text-red-400 transition-colors"
                  title="Remove slide"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Placeholders */}
              <div>
                <label className="block text-xs font-medium text-ocean-400 mb-2">
                  Placeholders
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_PLACEHOLDERS.map((placeholder) => (
                    <button
                      key={placeholder}
                      type="button"
                      onClick={() => togglePlaceholder(index, placeholder)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        slide.placeholders.includes(placeholder)
                          ? 'bg-gold-500/20 text-gold-400 border border-gold-500/50'
                          : 'bg-ocean-800 text-ocean-400 border border-ocean-700 hover:border-ocean-500'
                      }`}
                    >
                      {placeholder}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Create/Edit Template Modal
function TemplateModal({
  template,
  onClose,
  onSave,
}: {
  template: Template | null;
  onClose: () => void;
  onSave: (data: TemplateCreate) => Promise<void>;
}) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [slides, setSlides] = useState<SlideDefinition[]>(
    template?.slide_structure || [{ type: 'title', placeholders: ['title', 'subtitle'] }]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give yer template a name, captain!');
      return;
    }
    if (slides.length === 0) {
      setError('A deck needs at least one slide, ye scallywag!');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        slide_structure: slides,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template. Try again!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-ocean-900 border border-ocean-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ocean-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold-500/20 flex items-center justify-center">
              <Anchor className="w-5 h-5 text-gold-500" />
            </div>
            <h2 className="font-display text-xl font-semibold text-white">
              {template ? 'Edit Template' : 'Create New Template'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-ocean-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Name Input */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-ocean-200 mb-2">
              Template Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="e.g., Pirate Pitch Deck"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-ocean-200 mb-2">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[80px] resize-y"
              placeholder="Describe what this template be best used for..."
            />
          </div>

          {/* Slide Structure Builder */}
          <SlideStructureBuilder slides={slides} onChange={setSlides} />

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-900/30 border border-red-700 text-red-200 text-sm">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-ocean-700">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Anchor className="w-4 h-4" />
                {template ? 'Update Template' : 'Create Template'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Templates Page
export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await templateApi.list();
      setTemplates(data);
    } catch (err) {
      setError('Failed to fetch templates. The seas be rough!');
      console.error('Failed to fetch templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Handle create/update template
  const handleSaveTemplate = async (data: TemplateCreate) => {
    if (editingTemplate) {
      await templateApi.update(editingTemplate.id, data);
    } else {
      await templateApi.create(data);
    }
    await fetchTemplates();
  };

  // Handle delete template
  const handleDeleteTemplate = async (id: number) => {
    try {
      await templateApi.delete(id);
      await fetchTemplates();
    } catch (err) {
      setError('Failed to delete template. It be clinging to the mast!');
      console.error('Failed to delete template:', err);
    }
  };

  // Handle seed templates
  const handleSeedTemplates = async () => {
    try {
      setIsSeeding(true);
      await templateApi.seed();
      await fetchTemplates();
    } catch (err) {
      setError('Failed to seed templates. Try again, matey!');
      console.error('Failed to seed templates:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  // Handle use template (navigate to generate with template)
  const handleUseTemplate = (templateId: number) => {
    navigate(`/generate?template=${templateId}`);
  };

  // Handle edit template
  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setIsModalOpen(true);
  };

  // Handle open create modal
  const handleOpenCreateModal = () => {
    setEditingTemplate(null);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-ocean-600/30 flex items-center justify-center">
            <FileText className="w-6 h-6 text-ocean-300" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Template Harbor</h1>
            <p className="text-ocean-400">Chart templates for yer voyages</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSeedTemplates}
            disabled={isSeeding}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {isSeeding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Seeding...
              </>
            ) : (
              <>
                <Layers className="w-4 h-4" />
                Seed Starter Templates
              </>
            )}
          </button>
          <button onClick={handleOpenCreateModal} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-200">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="card text-center py-16">
          <Loader2 className="w-12 h-12 text-gold-500 mx-auto mb-4 animate-spin" />
          <p className="text-ocean-400">Loading yer templates...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && templates.length === 0 && (
        <div className="card text-center py-16">
          <FileText className="w-16 h-16 text-ocean-600 mx-auto mb-4" />
          <h2 className="font-display text-2xl font-semibold text-white mb-2">
            No Templates in Harbor
          </h2>
          <p className="text-ocean-400 max-w-md mx-auto mb-6">
            Create yer first template or seed the starter templates to get underway!
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={handleSeedTemplates} disabled={isSeeding} className="btn-secondary">
              {isSeeding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Seeding...
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  Seed Starters
                </>
              )}
            </button>
            <button onClick={handleOpenCreateModal} className="btn-primary">
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          </div>
        </div>
      )}

      {/* Template Grid */}
      {!isLoading && templates.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={() => handleUseTemplate(template.id)}
              onEdit={() => handleEditTemplate(template)}
              onDelete={() => handleDeleteTemplate(template.id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTemplate(null);
          }}
          onSave={handleSaveTemplate}
        />
      )}
    </div>
  );
}
