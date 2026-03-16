import type { ClipboardItem, ClipboardQuery, PaginatedResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiService {
  private accessToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const { skipAuth = false, ...fetchOptions } = options;

    const headers: HeadersInit = {
      ...fetchOptions.headers,
    };

    // Only set Content-Type for requests with a body
    if (fetchOptions.body) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    if (!skipAuth && this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });

    if (response.status === 401 && !skipAuth) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        const retryHeaders: HeadersInit = {
          ...fetchOptions.headers,
          'Authorization': `Bearer ${this.accessToken}`,
        };
        if (fetchOptions.body) {
          (retryHeaders as Record<string, string>)['Content-Type'] = 'application/json';
        }

        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...fetchOptions,
          headers: retryHeaders,
          credentials: 'include',
        });

        if (!retryResponse.ok) {
          const error = await retryResponse.json().catch(() => ({}));
          throw new ApiError(
            error.message || 'Request failed',
            retryResponse.status,
            error.code,
            error.details,
          );
        }

        if (retryResponse.status === 204) {
          return undefined as T;
        }

        const data = await retryResponse.json();
        return data.data ?? data;
      }
      throw new ApiError('Unauthorized', 401);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Request failed',
        response.status,
        error.code,
        error.details,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const data = await response.json();
    return data.data ?? data;
  }

  async refreshToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefreshToken();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        this.accessToken = null;
        return false;
      }

      const responseData = await response.json();
      const tokenData = responseData.data ?? responseData;

      if (!tokenData.accessToken || typeof tokenData.accessToken !== 'string') {
        this.accessToken = null;
        return false;
      }

      this.accessToken = tokenData.accessToken;
      return true;
    } catch {
      this.accessToken = null;
      return false;
    }
  }

  get<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = new ApiService();

// Clipboard API

export async function createTextItem(content: string): Promise<ClipboardItem> {
  return api.post<ClipboardItem>('/clipboard', { type: 'text', content });
}

export async function uploadFile(file: File): Promise<ClipboardItem> {
  const formData = new FormData();
  formData.append('file', file);
  const token = api.getAccessToken();
  const response = await fetch(`${API_BASE_URL}/clipboard/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(error.message || 'Upload failed', response.status);
  }
  const data = await response.json();
  return data.data ?? data;
}

export async function getClipboardItems(
  query?: ClipboardQuery,
): Promise<PaginatedResponse<ClipboardItem>> {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) params.set(key, String(value));
    });
  }
  const qs = params.toString();
  return api.get<PaginatedResponse<ClipboardItem>>(
    `/clipboard${qs ? `?${qs}` : ''}`,
  );
}

export async function getClipboardItem(id: string): Promise<ClipboardItem> {
  return api.get<ClipboardItem>(`/clipboard/${id}`);
}

export async function updateClipboardItem(
  id: string,
  data: { content?: string; status?: string; isPublic?: boolean; isFavorite?: boolean },
): Promise<ClipboardItem> {
  return api.patch<ClipboardItem>(`/clipboard/${id}`, data);
}

export async function batchOperation(
  ids: string[],
  action: 'archive' | 'restore' | 'delete',
): Promise<{ count: number }> {
  return api.post<{ count: number }>('/clipboard/batch', { ids, action });
}

export async function deleteClipboardItem(id: string): Promise<void> {
  return api.delete<void>(`/clipboard/${id}`);
}

export async function getDownloadUrl(id: string): Promise<{ url: string }> {
  return api.get<{ url: string }>(`/clipboard/${id}/download`);
}

// Multipart upload API

export interface InitUploadResponse {
  itemId: string;
  uploadId: string;
  partSize: number;
  totalParts: number;
  storageKey: string;
}

export async function initMultipartUpload(data: {
  fileName: string;
  fileSize: number;
  mimeType: string;
}): Promise<InitUploadResponse> {
  return api.post<InitUploadResponse>('/clipboard/upload/init', data);
}

export async function getPartUploadUrl(
  itemId: string,
  partNumber: number,
): Promise<{ url: string; partNumber: number }> {
  return api.get<{ url: string; partNumber: number }>(
    `/clipboard/upload/${itemId}/url?partNumber=${partNumber}`,
  );
}

export async function recordUploadPart(
  itemId: string,
  data: { partNumber: number; eTag: string; size: number },
): Promise<void> {
  return api.post<void>(`/clipboard/upload/${itemId}/part`, data);
}

export async function completeMultipartUpload(
  itemId: string,
  parts: { partNumber: number; eTag: string }[],
): Promise<ClipboardItem> {
  return api.post<ClipboardItem>(`/clipboard/upload/${itemId}/complete`, { parts });
}

export async function abortMultipartUpload(itemId: string): Promise<void> {
  return api.post<void>(`/clipboard/upload/${itemId}/abort`);
}

// Sharing API

export async function enableSharing(
  itemId: string,
): Promise<{ shareToken: string; shareUrl: string }> {
  return api.post<{ shareToken: string; shareUrl: string }>(`/clipboard/${itemId}/share`);
}

export async function disableSharing(itemId: string): Promise<void> {
  return api.delete<void>(`/clipboard/${itemId}/share`);
}

export async function getPublicItem(shareToken: string): Promise<ClipboardItem> {
  return api.get<ClipboardItem>(`/share/${shareToken}`, { skipAuth: true });
}

export async function getPublicDownloadUrl(shareToken: string): Promise<{ url: string }> {
  return api.get<{ url: string }>(`/share/${shareToken}/download`, { skipAuth: true });
}

// System settings API

export async function getSystemSettings(): Promise<Record<string, unknown>> {
  return api.get<Record<string, unknown>>('/settings/system');
}

export async function updateSystemSettings(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return api.patch<Record<string, unknown>>('/settings/system', data);
}
