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
  id: string;
  filename: string;
  original_filename: string;
  content_type: string;
  size: number;
  asset_type: 'image' | 'font' | 'document' | 'other';
  user_id: string;
  brand_id?: string;
  created_at: string;
}

export interface Template {
  id: number;
  name: string;
  description?: string;
  thumbnail_url?: string;
  content?: string;
  schema?: Record<string, unknown>;
  user_id?: string;
  brand_id?: string;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
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

export const brandApi = {
  list: () => api.get<Brand[]>('/brands/'),
  get: (id: string) => api.get<Brand>(`/brands/${id}`),
  create: (data: Partial<Brand>) => api.post<Brand>('/brands/', data),
  update: (id: string, data: Partial<Brand>) => api.put<Brand>(`/brands/${id}`, data),
  delete: (id: string) => api.delete(`/brands/${id}`),
};

// ============================================================================
// Asset API
// ============================================================================

export const assetApi = {
  list: (brandId?: string) =>
    api.get<Asset[]>('/assets/', { params: brandId ? { brand_id: brandId } : {} }),
  get: (id: string) => api.get<Asset>(`/assets/${id}`),
  upload: (file: File, brandId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (brandId) formData.append('brand_id', brandId);
    return api.post<Asset>('/assets/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id: string) => api.delete(`/assets/${id}`),
  getUrl: (id: string) => `${API_BASE}/assets/${id}/file`,
};

// ============================================================================
// Template API
// ============================================================================

export const templateApi = {
  list: async (brandId?: string): Promise<Template[]> => {
    const response = await api.get<Template[]>('/templates/', {
      params: brandId ? { brand_id: brandId } : {},
    });
    return response.data;
  },
  get: (id: string) => api.get<Template>(`/templates/${id}`),
  create: (data: Partial<Template>) => api.post<Template>('/templates/', data),
  update: (id: string, data: Partial<Template>) => api.put<Template>(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),
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

export { API_BASE };
