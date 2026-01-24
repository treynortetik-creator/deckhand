import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface Brand {
  id: string;
  name: string;
  description?: string;
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
  logo_asset_id?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: number;
  filename: string;
  file_type: string;
  file_url: string;
  file_size: number;
  tags: string[] | null;
  uploaded_by: number | null;
  uploaded_at: string;
}

export interface AssetListResponse {
  assets: Asset[];
  total: number;
}

export interface SlideDefinition {
  type: 'title' | 'content' | 'image' | 'two-column' | 'quote';
  placeholders: string[];
}

export interface Template {
  id: number;
  name: string;
  description?: string;
  slide_structure?: SlideDefinition[];
  created_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TemplateCreate {
  name: string;
  description?: string;
  slide_structure: SlideDefinition[];
}

export interface TemplateListResponse {
  templates: Template[];
  total: number;
}

export interface GeneratedDocument {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  user_id: string;
  template_id?: string;
  brand_id?: string;
  prompt?: string;
  created_at: string;
}

// Generation types for deck generation
export interface GenerationRequest {
  prompt: string;
  template_id?: number;
  slide_count: number;
  tone: 'professional' | 'casual' | 'formal' | 'creative';
}

export interface GenerationResponse {
  id: number;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  google_slides_url?: string;
  created_at: string;
}

export interface ProgressResponse {
  status: string;
  current_step: string;
  progress: number;
  deck_id?: number;
  error?: string;
}

// ============================================================================
// Auth API
// ============================================================================

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string; token_type: string }>('/auth/login', { email, password }),
  register: (email: string, password: string, fullName?: string) =>
    api.post<{ access_token: string; token_type: string }>('/auth/register', {
      email,
      password,
      full_name: fullName,
    }),
  me: () => api.get<User>('/auth/me'),
};

// ============================================================================
// Brand API
// ============================================================================

export interface BrandUpdate {
  name?: string;
  description?: string;
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
}

export const brandApi = {
  list: () => api.get<Brand[]>('/brands/'),
  get: (id: string) => api.get<Brand>(`/brands/${id}`),
  getCurrent: () => api.get<Brand>('/brand'),
  create: (data: Partial<Brand>) => api.post<Brand>('/brands/', data),
  update: (id: string, data: Partial<Brand>) => api.put<Brand>(`/brands/${id}`, data),
  updateCurrent: (data: BrandUpdate) => api.patch<Brand>('/brand', data),
  delete: (id: string) => api.delete(`/brands/${id}`),
  uploadPdf: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/brand/upload-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ============================================================================
// Asset API
// ============================================================================

export const assetApi = {
  list: (params?: { skip?: number; limit?: number; type_filter?: string }) =>
    api.get<AssetListResponse>('/assets', { params }),
  get: (id: number) => api.get<Asset>(`/assets/${id}`),
  upload: (file: File, tags: string[] = []) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<Asset>('/assets', formData, {
      params: tags.length > 0 ? { tags: JSON.stringify(tags) } : undefined,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id: number) => api.delete(`/assets/${id}`),
  updateTags: (id: number, tags: string[]) => api.patch<Asset>(`/assets/${id}`, { tags }),
  downloadUrl: (id: number) => `${API_BASE}/assets/${id}/download`,
};

// ============================================================================
// Template API
// ============================================================================

export const templateApi = {
  list: async (): Promise<Template[]> => {
    const response = await api.get<TemplateListResponse>('/templates/');
    return response.data.templates;
  },
  get: async (id: number): Promise<Template> => {
    const response = await api.get<Template>(`/templates/${id}`);
    return response.data;
  },
  create: async (data: TemplateCreate): Promise<Template> => {
    const response = await api.post<Template>('/templates/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<TemplateCreate>): Promise<Template> => {
    const response = await api.patch<Template>(`/templates/${id}`, data);
    return response.data;
  },
  delete: (id: number) => api.delete(`/templates/${id}`),
  seed: async (): Promise<Template[]> => {
    const response = await api.post<Template[]>('/templates/seed');
    return response.data;
  },
};

// ============================================================================
// Generate API (for deck/slide generation)
// ============================================================================

export const generateApi = {
  generate: async (data: GenerationRequest): Promise<GenerationResponse> => {
    const response = await api.post<GenerationResponse>('/generate', data);
    return response.data;
  },
  progress: async (): Promise<ProgressResponse> => {
    const response = await api.get<ProgressResponse>('/generate/progress');
    return response.data;
  },
  // PDF generation endpoints
  fromPrompt: (prompt: string, brandId?: string) =>
    api.post<GeneratedDocument>(
      '/generate/from-prompt',
      { prompt, brand_id: brandId },
      { responseType: 'blob' }
    ),
  fromTemplate: (templateId: string, data: Record<string, unknown>, brandId?: string) =>
    api.post<GeneratedDocument>(
      '/generate/from-template',
      { template_id: templateId, data, brand_id: brandId },
      { responseType: 'blob' }
    ),
  list: () => api.get<GeneratedDocument[]>('/generate/history'),
  get: (id: string) => api.get(`/generate/${id}/file`, { responseType: 'blob' }),
};

// ============================================================================
// Export API
// ============================================================================

export const exportApi = {
  pptx: async (deckId: number): Promise<{ download_url: string }> => {
    const response = await api.post<{ download_url: string }>(`/export/${deckId}/pptx`);
    return response.data;
  },
  googleSlides: async (deckId: number): Promise<{ url: string }> => {
    const response = await api.post<{ url: string }>(`/export/${deckId}/google-slides`);
    return response.data;
  },
  downloadPptx: (deckId: number) => `${API_BASE}/export/${deckId}/pptx/download`,
};

// ============================================================================
// System Prompts API
// ============================================================================

export interface SystemPrompt {
  name: string;
  prompt_text: string;
  description?: string;
  updated_at?: string;
}

export const promptApi = {
  listSystem: () => api.get<SystemPrompt[]>('/prompts/system/all'),
  updateSystem: (name: string, promptText: string) =>
    api.put<SystemPrompt>(`/prompts/system/${name}`, { prompt_text: promptText }),
  seedSystem: () => api.post('/prompts/system/seed'),
};

// ============================================================================
// Model Configuration API
// ============================================================================

export interface ModelConfig {
  id: number;
  model_type: 'llm' | 'image';
  model_id: string;
  display_name: string;
  is_default: boolean;
  is_enabled: boolean;
  config?: Record<string, unknown>;
}

export interface AvailableModel {
  model_id: string;
  display_name: string;
}

export interface AvailableModels {
  llm: AvailableModel[];
  image: AvailableModel[];
}

export interface DefaultModels {
  llm: ModelConfig | null;
  image: ModelConfig | null;
}

export const modelsApi = {
  list: (modelType?: string) =>
    api.get<ModelConfig[]>('/models/', { params: modelType ? { model_type: modelType } : undefined }),
  available: () => api.get<AvailableModels>('/models/available'),
  defaults: () => api.get<DefaultModels>('/models/defaults'),
  create: (data: Omit<ModelConfig, 'id'>) => api.post<ModelConfig>('/models/', data),
  update: (id: number, data: Partial<ModelConfig>) => api.patch<ModelConfig>(`/models/${id}`, data),
  delete: (id: number) => api.delete(`/models/${id}`),
  seed: () => api.post('/models/seed'),
};

// Legacy configApi for backward compatibility
export const configApi = {
  getModels: async () => {
    const defaults = await modelsApi.defaults();
    return {
      data: {
        llm_model: defaults.data.llm?.model_id || 'anthropic/claude-3.5-sonnet',
        image_model: defaults.data.image?.model_id || 'openai/dall-e-3',
        openrouter_dashboard_url: 'https://openrouter.ai/activity',
      },
    };
  },
};

// ============================================================================
// History API
// ============================================================================

export interface DeckHistoryItem {
  id: number;
  title: string;
  prompt_used: string | null;
  template_id: number | null;
  google_slides_url: string | null;
  pptx_file_path: string | null;
  model_used: string | null;
  generation_time_seconds: number | null;
  created_by: number | null;
  created_at: string;
}

export interface DeckListResponse {
  decks: DeckHistoryItem[];
  total: number;
}

export interface GenerationHistoryItem {
  id: number;
  prompt: string | null;
  template_id: number | null;
  assets_used: unknown[] | null;
  model_used: string | null;
  deck_id: number | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface GenerationListResponse {
  history: GenerationHistoryItem[];
  total: number;
}

export const historyApi = {
  decks: (params?: { skip?: number; limit?: number }) =>
    api.get<DeckListResponse>('/history/decks', { params }),
  deck: (id: number) => api.get<DeckHistoryItem>(`/history/decks/${id}`),
  generations: (params?: { skip?: number; limit?: number; success_only?: boolean }) =>
    api.get<GenerationListResponse>('/history/generations', { params }),
};

export { API_BASE };
