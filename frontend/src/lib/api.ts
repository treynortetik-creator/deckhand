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

// Auth API
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

// Types
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
  id: string;
  name: string;
  description?: string;
  content: string;
  schema?: Record<string, unknown>;
  user_id: string;
  brand_id?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
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

// Brand API
export const brandApi = {
  list: () => api.get<Brand[]>('/brands/'),
  get: (id: string) => api.get<Brand>(`/brands/${id}`),
  create: (data: Partial<Brand>) => api.post<Brand>('/brands/', data),
  update: (id: string, data: Partial<Brand>) => api.put<Brand>(`/brands/${id}`, data),
  delete: (id: string) => api.delete(`/brands/${id}`),
};

// Asset API
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

// Template API
export const templateApi = {
  list: (brandId?: string) =>
    api.get<Template[]>('/templates/', { params: brandId ? { brand_id: brandId } : {} }),
  get: (id: string) => api.get<Template>(`/templates/${id}`),
  create: (data: Partial<Template>) => api.post<Template>('/templates/', data),
  update: (id: string, data: Partial<Template>) => api.put<Template>(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),
};

// Generate API
export const generateApi = {
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

export { API_BASE };
