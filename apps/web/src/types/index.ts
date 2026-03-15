export interface User {
  id: string;
  email: string;
  displayName: string | null;
  profileImageUrl: string | null;
  isActive: boolean;
  isAdmin: boolean;
}

export interface AuthProvider {
  name: string;
  enabled: boolean;
}

export interface ClipboardItem {
  id: string;
  userId: string;
  type: 'text' | 'image' | 'file' | 'media';
  content: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  storageKey: string | null;
  status: 'active' | 'archived' | 'deleted';
  isPublic: boolean;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClipboardQuery {
  page?: number;
  pageSize?: number;
  type?: 'text' | 'image' | 'file' | 'media';
  status?: 'active' | 'archived' | 'deleted';
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'fileName';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
