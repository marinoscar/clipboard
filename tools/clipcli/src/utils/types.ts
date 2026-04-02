export type OutputMode = 'human' | 'json' | 'quiet';

export interface CliResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface GlobalOptions {
  json?: boolean;
  quiet?: boolean;
  server?: string;
  color?: boolean;
  verbose?: boolean;
}

export interface AuthData {
  token: string;
  serverUrl: string;
}

export interface UserInfo {
  id: string;
  email: string;
  displayName: string | null;
  profileImageUrl: string | null;
  isActive: boolean;
  isAdmin: boolean;
}

export interface ClipboardItem {
  id: string;
  userId: string;
  type: string;
  content: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  storageKey: string | null;
  uploadStatus: string | null;
  status: string;
  isPublic: boolean;
  isFavorite: boolean;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ShareResult {
  shareToken: string;
  shareUrl: string;
}

export interface DownloadUrlResult {
  url: string;
}

export interface MultipartInitResult {
  itemId: string;
  uploadId: string;
  totalParts: number;
  partSize: number;
}
