import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicItemPage from './PublicItemPage';
import type { ClipboardItem } from '../types';

vi.mock('../services/api', () => ({
  getPublicItem: vi.fn(),
  getPublicDownloadUrl: vi.fn(),
}));

import { getPublicItem, getPublicDownloadUrl } from '../services/api';

const mockedGetPublicItem = vi.mocked(getPublicItem);
const mockedGetPublicDownloadUrl = vi.mocked(getPublicDownloadUrl);

function makeItem(overrides: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    id: 'item-1',
    userId: 'user-1',
    type: 'text',
    content: 'shared text content',
    fileName: null,
    fileSize: null,
    mimeType: null,
    storageKey: null,
    uploadStatus: null,
    s3UploadId: null,
    status: 'active',
    isPublic: true,
    shareToken: 'share-abc',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderWithToken(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/share/${token}`]}>
      <Routes>
        <Route path="/share/:shareToken" element={<PublicItemPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicItemPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows loading state initially', () => {
    mockedGetPublicItem.mockReturnValue(new Promise(() => {})); // never resolves

    renderWithToken('share-abc');

    // LoadingSpinner renders a CircularProgress role="progressbar"
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders a text item after loading', async () => {
    mockedGetPublicItem.mockResolvedValue(makeItem());

    renderWithToken('share-abc');

    await waitFor(() => {
      expect(screen.getByText('shared text content')).toBeInTheDocument();
    });
  });

  it('renders the Clipboard branding header', async () => {
    mockedGetPublicItem.mockResolvedValue(makeItem());

    renderWithToken('share-abc');

    await waitFor(() => {
      expect(screen.getByText('Clipboard')).toBeInTheDocument();
    });
  });

  it('renders the footer', async () => {
    mockedGetPublicItem.mockResolvedValue(makeItem());

    renderWithToken('share-abc');

    await waitFor(() => {
      expect(screen.getByText(/Powered by Clipboard/)).toBeInTheDocument();
    });
  });

  it('shows item not found state on 404', async () => {
    mockedGetPublicItem.mockRejectedValue(new Error('Not Found'));

    renderWithToken('bad-token');

    await waitFor(() => {
      expect(screen.getByText('Item not found')).toBeInTheDocument();
    });
  });

  it('renders file item with file name and download button', async () => {
    const item = makeItem({
      type: 'file',
      content: null,
      fileName: 'document.pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
    });
    mockedGetPublicItem.mockResolvedValue(item);

    renderWithToken('share-abc');

    await waitFor(() => {
      // The filename appears in both the header and the file content area
      const matches = screen.getAllByText('document.pdf');
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    });
  });

  it('renders image item with download button', async () => {
    const item = makeItem({
      type: 'image',
      content: null,
      fileName: 'photo.png',
      fileSize: 1024,
      mimeType: 'image/png',
    });
    mockedGetPublicItem.mockResolvedValue(item);
    mockedGetPublicDownloadUrl.mockResolvedValue({ url: 'https://s3.example.com/photo.png' });

    renderWithToken('share-abc');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    });
  });

  it('shows item type label in the detail view', async () => {
    mockedGetPublicItem.mockResolvedValue(makeItem({ type: 'text' }));

    renderWithToken('share-abc');

    await waitFor(() => {
      expect(screen.getByText(/Shared item/)).toBeInTheDocument();
    });
  });
});
