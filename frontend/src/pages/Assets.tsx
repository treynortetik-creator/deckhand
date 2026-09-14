import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Image,
  Upload,
  FileText,
  Trash2,
  Download,
  Tag,
  Search,
  X,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { assetApi, type Asset, type AssetListResponse } from '../lib/api';

// Type filter options
type TypeFilter = 'all' | 'image' | 'document';

// Helper to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper to format dates
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Check if file type is an image
function isImageType(fileType: string): boolean {
  return fileType.startsWith('image/');
}

// Validate file before upload
function validateFile(file: File, maxSizeMb = 50): string | null {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (!allowedTypes.includes(file.type)) {
    return 'File type not supported. Please upload images (JPEG, PNG, GIF, WebP, SVG), PDFs, or Word documents.';
  }
  if (file.size > maxSizeMb * 1024 * 1024) {
    return `File is too large. Maximum size is ${maxSizeMb}MB.`;
  }
  return null;
}

// Tag colors for variety
const TAG_COLORS = [
  'bg-gold-500/20 text-gold-300 border-gold-500/30',
  'bg-ocean-500/20 text-ocean-300 border-ocean-500/30',
  'bg-wood-500/20 text-wood-300 border-wood-500/30',
  'bg-green-500/20 text-green-300 border-green-500/30',
  'bg-purple-500/20 text-purple-300 border-purple-500/30',
];

function getTagColor(tag: string): string {
  const index = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TAG_COLORS[index % TAG_COLORS.length];
}

export default function Assets() {
  // State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Asset | null>(null);
  const [editingTags, setEditingTags] = useState<Asset | null>(null);
  const [editTagsInput, setEditTagsInput] = useState('');
  const [editTagsList, setEditTagsList] = useState<string[]>([]);

  // Fetch assets
  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: { type_filter?: string } = {};
      if (typeFilter !== 'all') {
        params.type_filter = typeFilter;
      }
      const response = await assetApi.list(params);
      const data: AssetListResponse = response.data;
      setAssets(data.assets);
      setTotal(data.total);
    } catch {
      setError('Failed to fetch yer treasures, matey. Try again!');
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Filter assets by search query (client-side) - memoized for performance
  const filteredAssets = useMemo(
    () => assets.filter((asset) => asset.filename.toLowerCase().includes(searchQuery.toLowerCase())),
    [assets, searchQuery]
  );

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload file
  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    // Simulate upload progress for UX
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 150);

    try {
      await assetApi.upload(file, uploadTags);
      setUploadProgress(100);
      setUploadTags([]);
      setTagInput('');
      await fetchAssets();
    } catch (err: unknown) {
      const message =
        err instanceof Error && (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          ? (err as { response: { data: { detail: string } } }).response.data.detail
          : 'Arrr! Failed to stow yer treasure. Check the file type and try again!';
      setError(message);
    } finally {
      clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Add tag to upload
  const addUploadTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !uploadTags.includes(tag)) {
      setUploadTags([...uploadTags, tag]);
      setTagInput('');
    }
  };

  const removeUploadTag = (tag: string) => {
    setUploadTags(uploadTags.filter((t) => t !== tag));
  };

  // Handle tag input keydown
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addUploadTag();
    }
  };

  // Download asset using Authorization header (keeps token out of URL)
  const downloadAsset = async (asset: Asset) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(assetApi.downloadUrl(asset.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = asset.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download the file. Please try again.');
    }
  };

  // Delete asset
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await assetApi.delete(deleteConfirm.id);
      setDeleteConfirm(null);
      await fetchAssets();
    } catch {
      setError('Failed to throw that treasure overboard!');
    }
  };

  // Edit tags
  const startEditingTags = (asset: Asset) => {
    setEditingTags(asset);
    setEditTagsList(asset.tags || []);
    setEditTagsInput('');
  };

  const addEditTag = () => {
    const tag = editTagsInput.trim().toLowerCase();
    if (tag && !editTagsList.includes(tag)) {
      setEditTagsList([...editTagsList, tag]);
      setEditTagsInput('');
    }
  };

  const removeEditTag = (tag: string) => {
    setEditTagsList(editTagsList.filter((t) => t !== tag));
  };

  const handleEditTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEditTag();
    }
  };

  const saveTags = async () => {
    if (!editingTags) return;
    try {
      await assetApi.updateTags(editingTags.id, editTagsList);
      setEditingTags(null);
      await fetchAssets();
    } catch {
      setError('Failed to update the treasure tags!');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-lg bg-wood-600/30 flex items-center justify-center">
          <Image className="w-6 h-6 text-wood-300" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Treasure Chest</h1>
          <p className="text-ocean-400">Yer vault of images and precious documents</p>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        className={`card mb-6 border-2 border-dashed transition-all cursor-pointer ${
          isDragging
            ? 'border-gold-500 bg-gold-500/10'
            : 'border-ocean-600 hover:border-ocean-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload file"
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,.pdf,.docx"
          onChange={handleFileSelect}
        />

        {isUploading ? (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 text-gold-500 mx-auto mb-4 animate-spin" />
            <p className="text-ocean-200 mb-4">Stowing yer treasure... {uploadProgress}%</p>
            <div className="max-w-xs mx-auto">
              <div className="h-2 bg-ocean-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <Upload className="w-12 h-12 text-ocean-400 mx-auto mb-4" />
            <p className="text-ocean-200 mb-2">
              Drag and drop yer treasure here, or click to browse
            </p>
            <p className="text-ocean-500 text-sm">
              Accepts images (JPEG, PNG, GIF, WebP, SVG) and documents (PDF, DOCX) up to 50MB
            </p>
          </div>
        )}
      </div>

      {/* Tags Input for Upload */}
      <div className="card mb-6" onClick={(e) => e.stopPropagation()}>
        <label className="block text-sm font-medium text-ocean-200 mb-2">
          <Tag className="w-4 h-4 inline mr-2" />
          Tags for next upload (optional)
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {uploadTags.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm border ${getTagColor(tag)}`}
            >
              {tag}
              <button
                onClick={() => removeUploadTag(tag)}
                className="hover:text-white transition-colors"
                aria-label={`Remove tag ${tag}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Add a tag..."
            className="input flex-1"
            maxLength={50}
          />
          <button
            onClick={addUploadTag}
            className="btn-secondary px-4"
            disabled={!tagInput.trim()}
          >
            Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Type Filter */}
        <div className="flex gap-2">
          {(['all', 'image', 'document'] as TypeFilter[]).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                typeFilter === type
                  ? 'bg-gold-500 text-ocean-950'
                  : 'bg-ocean-800 text-ocean-200 hover:bg-ocean-700'
              }`}
            >
              {type === 'all' ? 'All Loot' : type === 'image' ? 'Images' : 'Documents'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ocean-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search yer treasures..."
            className="input pl-10 w-full"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="card text-center py-16">
          <Loader2 className="w-12 h-12 text-gold-500 mx-auto mb-4 animate-spin" />
          <p className="text-ocean-400">Loading yer treasures...</p>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="card text-center py-16">
          <Image className="w-16 h-16 text-ocean-600 mx-auto mb-4" />
          <h2 className="font-display text-2xl font-semibold text-white mb-2">
            {searchQuery ? 'No treasures found' : 'Yer chest be empty!'}
          </h2>
          <p className="text-ocean-400 max-w-md mx-auto">
            {searchQuery
              ? 'No treasures match yer search. Try a different query.'
              : 'Upload some images or documents to fill yer treasure chest.'}
          </p>
        </div>
      ) : (
        <>
          {/* Asset Count */}
          <p className="text-ocean-400 mb-4">
            Showing {filteredAssets.length} of {total} treasures
          </p>

          {/* Asset Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className="card group cursor-pointer"
                onClick={() => isImageType(asset.file_type) && setPreviewAsset(asset)}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-ocean-800 rounded-lg mb-3 overflow-hidden flex items-center justify-center relative">
                  {isImageType(asset.file_type) ? (
                    <img
                      src={assetApi.downloadUrl(asset.id)}
                      alt={`Preview of ${asset.filename}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-center">
                      <FileText className="w-12 h-12 text-ocean-500 mx-auto" />
                      <p className="text-ocean-500 text-xs mt-1 uppercase">
                        {asset.file_type.split('/').pop()}
                      </p>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-ocean-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadAsset(asset);
                      }}
                      className="p-2 rounded-lg bg-ocean-700 hover:bg-ocean-600 transition-colors"
                      title="Download"
                      aria-label={`Download ${asset.filename}`}
                    >
                      <Download className="w-5 h-5 text-ocean-200" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditingTags(asset);
                      }}
                      className="p-2 rounded-lg bg-ocean-700 hover:bg-ocean-600 transition-colors"
                      title="Edit Tags"
                      aria-label={`Edit tags for ${asset.filename}`}
                    >
                      <Tag className="w-5 h-5 text-ocean-200" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(asset);
                      }}
                      className="p-2 rounded-lg bg-red-900/50 hover:bg-red-800/50 transition-colors"
                      title="Delete"
                      aria-label={`Delete ${asset.filename}`}
                    >
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </button>
                  </div>
                </div>

                {/* File Info */}
                <h3 className="text-white font-medium truncate mb-1" title={asset.filename}>
                  {asset.filename}
                </h3>
                <div className="flex items-center justify-between text-sm text-ocean-400 mb-2">
                  <span>{formatFileSize(asset.file_size)}</span>
                  <span>{formatDate(asset.uploaded_at)}</span>
                </div>

                {/* Tags */}
                {asset.tags && asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {asset.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className={`px-2 py-0.5 rounded-full text-xs border ${getTagColor(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                    {asset.tags.length > 3 && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-ocean-700 text-ocean-300">
                        +{asset.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Preview Modal */}
      {previewAsset && (
        <div
          className="fixed inset-0 z-50 bg-ocean-950/90 flex items-center justify-center p-4"
          onClick={() => setPreviewAsset(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${previewAsset.filename}`}
        >
          <div
            className="relative max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewAsset(null)}
              className="absolute -top-12 right-0 p-2 text-ocean-300 hover:text-white transition-colors"
              aria-label="Close preview"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={assetApi.downloadUrl(previewAsset.id)}
              alt={previewAsset.filename}
              className="max-w-full max-h-[80vh] object-contain rounded-lg mx-auto block"
            />
            <div className="mt-4 text-center">
              <p className="text-white font-medium">{previewAsset.filename}</p>
              <p className="text-ocean-400 text-sm">
                {formatFileSize(previewAsset.file_size)} &middot; {formatDate(previewAsset.uploaded_at)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 bg-ocean-950/90 flex items-center justify-center p-4"
          onClick={() => setDeleteConfirm(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-semibold text-white mb-4">
              Walk the Plank?
            </h3>
            <p className="text-ocean-300 mb-6">
              Are ye sure ye want to throw <strong className="text-white">{deleteConfirm.filename}</strong> overboard?
              This treasure will be lost forever!
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary"
              >
                Keep It
              </button>
              <button
                onClick={confirmDelete}
                className="btn-primary bg-red-600 hover:bg-red-500 border-red-600"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tags Modal */}
      {editingTags && (
        <div
          className="fixed inset-0 z-50 bg-ocean-950/90 flex items-center justify-center p-4"
          onClick={() => setEditingTags(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-semibold text-white mb-4">
              Edit Treasure Tags
            </h3>
            <p className="text-ocean-400 text-sm mb-4 truncate" title={editingTags.filename}>
              {editingTags.filename}
            </p>

            {/* Current Tags */}
            <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]">
              {editTagsList.length === 0 ? (
                <span className="text-ocean-500 text-sm">No tags yet</span>
              ) : (
                editTagsList.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm border ${getTagColor(tag)}`}
                  >
                    {tag}
                    <button
                      onClick={() => removeEditTag(tag)}
                      className="hover:text-white transition-colors"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Add Tag Input */}
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={editTagsInput}
                onChange={(e) => setEditTagsInput(e.target.value)}
                onKeyDown={handleEditTagKeyDown}
                placeholder="Add a tag..."
                className="input flex-1"
                maxLength={50}
              />
              <button
                onClick={addEditTag}
                className="btn-secondary px-4"
                disabled={!editTagsInput.trim()}
              >
                Add
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEditingTags(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={saveTags} className="btn-primary">
                <Check className="w-4 h-4" />
                Save Tags
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
