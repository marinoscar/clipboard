import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import ShareTargetPage from './ShareTargetPage';

// Mock modules
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

vi.mock('../services/api', () => ({
  createTextItem: vi.fn(),
  uploadFile: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useMultipartUpload', () => ({
  useMultipartUpload: vi.fn(),
}));

vi.mock('../services/shareStorage', () => ({
  getPendingShare: vi.fn(),
  deletePendingShare: vi.fn(),
  cleanupStaleShares: vi.fn(),
}));

import { useNavigate } from 'react-router-dom';
import { createTextItem, uploadFile } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getPendingShare, deletePendingShare, cleanupStaleShares } from '../services/shareStorage';
import { useMultipartUpload } from '../hooks/useMultipartUpload';

const mockedUseNavigate = vi.mocked(useNavigate);
const mockedCreateTextItem = vi.mocked(createTextItem);
const mockedUploadFile = vi.mocked(uploadFile);
const mockedUseAuth = vi.mocked(useAuth);
const mockedGetPendingShare = vi.mocked(getPendingShare);
const mockedDeletePendingShare = vi.mocked(deletePendingShare);
const mockedCleanupStaleShares = vi.mocked(cleanupStaleShares);
const mockedUseMultipartUpload = vi.mocked(useMultipartUpload);

const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // mirrors useMultipartUpload

const mockedStartUpload = vi.fn();

function makeFileOfSize(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseNavigate.mockReturnValue(vi.fn());
  mockedCleanupStaleShares.mockResolvedValue(undefined);
  mockedDeletePendingShare.mockResolvedValue(undefined);
  mockedStartUpload.mockResolvedValue({ id: 'multipart-item' });
  mockedUseMultipartUpload.mockReturnValue({
    isUploading: false,
    progress: 0,
    error: null,
    currentFile: null,
    startUpload: mockedStartUpload,
    abort: vi.fn(),
    isLargeFile: (file: File) => file.size > MULTIPART_THRESHOLD,
  });
});

describe('ShareTargetPage', () => {
  it('shows loading spinner while auth is resolving', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      providers: [],
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    mockedGetPendingShare.mockResolvedValue(null);

    render(<ShareTargetPage />, { wrapper });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('processes pending text share when authenticated', async () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@test.com', displayName: null, profileImageUrl: null, isActive: true, isAdmin: false },
      isLoading: false,
      isAuthenticated: true,
      providers: [],
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    mockedGetPendingShare.mockResolvedValue({
      id: 1,
      text: 'shared text',
      file: null,
      fileName: null,
      fileType: null,
      timestamp: Date.now(),
    });
    mockedCreateTextItem.mockResolvedValue({} as never);

    render(<ShareTargetPage />, { wrapper });

    await waitFor(() => {
      expect(mockedCreateTextItem).toHaveBeenCalledWith('shared text');
      expect(mockedDeletePendingShare).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(screen.getByText(/Content saved to clipboard/i)).toBeInTheDocument();
    });
  });

  it('processes pending file share when authenticated', async () => {
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@test.com', displayName: null, profileImageUrl: null, isActive: true, isAdmin: false },
      isLoading: false,
      isAuthenticated: true,
      providers: [],
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    mockedGetPendingShare.mockResolvedValue({
      id: 2,
      text: null,
      file,
      fileName: 'photo.png',
      fileType: 'image/png',
      timestamp: Date.now(),
    });
    mockedUploadFile.mockResolvedValue({} as never);

    render(<ShareTargetPage />, { wrapper });

    await waitFor(() => {
      expect(mockedUploadFile).toHaveBeenCalledWith(file);
      expect(mockedDeletePendingShare).toHaveBeenCalledWith(2);
    });
  });

  it('routes a large shared file through the multipart upload, not the simple endpoint', async () => {
    const file = makeFileOfSize('movie.mp4', 'video/mp4', 42 * 1024 * 1024);
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@test.com', displayName: null, profileImageUrl: null, isActive: true, isAdmin: false },
      isLoading: false,
      isAuthenticated: true,
      providers: [],
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    mockedGetPendingShare.mockResolvedValue({
      id: 3,
      text: null,
      file,
      fileName: 'movie.mp4',
      fileType: 'video/mp4',
      timestamp: Date.now(),
    });

    render(<ShareTargetPage />, { wrapper });

    await waitFor(() => {
      expect(mockedStartUpload).toHaveBeenCalledWith(file);
    });
    expect(mockedUploadFile).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(mockedDeletePendingShare).toHaveBeenCalledWith(3);
    });
  });

  it('redirects to login when not authenticated with pending share', async () => {
    const mockNavigate = vi.fn();
    mockedUseNavigate.mockReturnValue(mockNavigate);
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      providers: [],
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    mockedGetPendingShare.mockResolvedValue({
      id: 3,
      text: 'needs auth',
      file: null,
      fileName: null,
      fileType: null,
      timestamp: Date.now(),
    });

    render(<ShareTargetPage />, { wrapper });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', {
        state: { from: { pathname: '/share-target', search: '' } },
        replace: true,
      });
    });
  });

  it('redirects home when no pending share exists', async () => {
    const mockNavigate = vi.fn();
    mockedUseNavigate.mockReturnValue(mockNavigate);
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@test.com', displayName: null, profileImageUrl: null, isActive: true, isAdmin: false },
      isLoading: false,
      isAuthenticated: true,
      providers: [],
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    mockedGetPendingShare.mockResolvedValue(null);

    render(<ShareTargetPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/No shared content found/i)).toBeInTheDocument();
    });
  });

  it('shows error when upload fails', async () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@test.com', displayName: null, profileImageUrl: null, isActive: true, isAdmin: false },
      isLoading: false,
      isAuthenticated: true,
      providers: [],
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    mockedGetPendingShare.mockResolvedValue({
      id: 4,
      text: 'will fail',
      file: null,
      fileName: null,
      fileType: null,
      timestamp: Date.now(),
    });
    mockedCreateTextItem.mockRejectedValue(new Error('Server error'));

    render(<ShareTargetPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('cleans up stale shares on mount', async () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@test.com', displayName: null, profileImageUrl: null, isActive: true, isAdmin: false },
      isLoading: false,
      isAuthenticated: true,
      providers: [],
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    mockedGetPendingShare.mockResolvedValue(null);

    render(<ShareTargetPage />, { wrapper });

    await waitFor(() => {
      expect(mockedCleanupStaleShares).toHaveBeenCalled();
    });
  });
});
