import { config } from '../utils/config.js';
import { loadAuth } from './auth-store.js';
import type {
  ClipboardItem,
  DownloadUrlResult,
  MultipartInitResult,
  PaginatedResponse,
  ShareResult,
  UserInfo,
} from '../utils/types.js';

function getToken(): string {
  const auth = loadAuth();
  if (!auth) {
    throw new Error('Not authenticated. Run: clipcli auth login');
  }
  return auth.token;
}

export interface ApiRequestOptions extends RequestInit {
  requireAuth?: boolean;
}

export async function apiRequest(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Response> {
  const { requireAuth = true, ...fetchOptions } = options;
  const url = `${config.apiUrl}${path}`;
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (requireAuth) {
    headers['Authorization'] = `Bearer ${getToken()}`;
  }

  // Only set Content-Type for JSON bodies
  if (fetchOptions.body && typeof fetchOptions.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...fetchOptions, headers });

  if (response.status === 401 && requireAuth) {
    throw new Error('Authentication failed. Your token may be expired or revoked. Run: clipcli auth login');
  }

  return response;
}

// Typed API methods

export async function getCurrentUser(): Promise<UserInfo> {
  const res = await apiRequest('/auth/me');
  if (!res.ok) throw new Error('Failed to get user info');
  const json = (await res.json()) as { data: UserInfo };
  return json.data;
}

export async function validateToken(token: string): Promise<UserInfo> {
  const url = `${config.apiUrl}/auth/me`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Invalid token');
  const json = (await res.json()) as { data: UserInfo };
  return json.data;
}

export async function getClipboardItems(params: {
  page?: number;
  pageSize?: number;
  type?: string;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  isFavorite?: boolean;
}): Promise<PaginatedResponse<ClipboardItem>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.type) query.set('type', params.type);
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.isFavorite !== undefined) query.set('isFavorite', String(params.isFavorite));

  const qs = query.toString();
  const res = await apiRequest(`/clipboard${qs ? '?' + qs : ''}`);
  if (!res.ok) throw new Error(`Failed to list items: ${res.status}`);
  const json = (await res.json()) as { data: PaginatedResponse<ClipboardItem> };
  return json.data;
}

export async function getClipboardItem(id: string): Promise<ClipboardItem> {
  const res = await apiRequest(`/clipboard/${id}`);
  if (!res.ok) throw new Error(`Failed to get item: ${res.status}`);
  const json = (await res.json()) as { data: ClipboardItem };
  return json.data;
}

export async function createTextItem(content: string): Promise<ClipboardItem> {
  const res = await apiRequest('/clipboard', {
    method: 'POST',
    body: JSON.stringify({ type: 'text', content }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create item: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { data: ClipboardItem };
  return json.data;
}

export async function deleteClipboardItem(id: string): Promise<ClipboardItem> {
  const res = await apiRequest(`/clipboard/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete item: ${res.status}`);
  const json = (await res.json()) as { data: ClipboardItem };
  return json.data;
}

export async function enableSharing(id: string): Promise<ShareResult> {
  const res = await apiRequest(`/clipboard/${id}/share`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to enable sharing: ${res.status}`);
  const json = (await res.json()) as { data: ShareResult };
  return json.data;
}

export async function disableSharing(id: string): Promise<void> {
  const res = await apiRequest(`/clipboard/${id}/share`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to disable sharing: ${res.status}`);
}

export async function getDownloadUrl(id: string): Promise<DownloadUrlResult> {
  const res = await apiRequest(`/clipboard/${id}/download`);
  if (!res.ok) throw new Error(`Failed to get download URL: ${res.status}`);
  const json = (await res.json()) as { data: DownloadUrlResult };
  return json.data;
}

export async function uploadFileSmall(
  filePath: string,
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<ClipboardItem> {
  // Build multipart/form-data manually
  const boundary = '----clipcli' + Date.now().toString(36);
  const parts: Buffer[] = [];

  // file field
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
  ));
  parts.push(buffer);
  parts.push(Buffer.from('\r\n'));

  // closing boundary
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const res = await apiRequest('/clipboard/upload', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    } as Record<string, string>,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { data: ClipboardItem };
  return json.data;
}

export async function initMultipartUpload(
  fileName: string,
  fileSize: number,
  mimeType: string,
): Promise<MultipartInitResult> {
  const res = await apiRequest('/clipboard/upload/init', {
    method: 'POST',
    body: JSON.stringify({ fileName, fileSize, mimeType }),
  });
  if (!res.ok) throw new Error(`Failed to init upload: ${res.status}`);
  const json = (await res.json()) as { data: MultipartInitResult };
  return json.data;
}

export async function getPartUploadUrl(
  itemId: string,
  partNumber: number,
): Promise<string> {
  const res = await apiRequest(`/clipboard/upload/${itemId}/url?partNumber=${partNumber}`);
  if (!res.ok) throw new Error(`Failed to get part URL: ${res.status}`);
  const json = (await res.json()) as { data: { url: string } };
  return json.data.url;
}

export async function recordUploadPart(
  itemId: string,
  partNumber: number,
  eTag: string,
  size: number,
): Promise<void> {
  const res = await apiRequest(`/clipboard/upload/${itemId}/part`, {
    method: 'POST',
    body: JSON.stringify({ partNumber, eTag, size }),
  });
  if (!res.ok) throw new Error(`Failed to record part: ${res.status}`);
}

export async function completeMultipartUpload(
  itemId: string,
  parts: { partNumber: number; eTag: string }[],
): Promise<ClipboardItem> {
  const res = await apiRequest(`/clipboard/upload/${itemId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ parts }),
  });
  if (!res.ok) throw new Error(`Failed to complete upload: ${res.status}`);
  const json = (await res.json()) as { data: ClipboardItem };
  return json.data;
}
