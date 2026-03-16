import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ArchivePage from './ArchivePage';
import type { ClipboardItem } from '../types';

// Mock the entire api module
vi.mock('../services/api', () => ({
  getClipboardItems: vi.fn(),
  deleteClipboardItem: vi.fn(),
  updateClipboardItem: vi.fn(),
  batchOperation: vi.fn(),
  getSystemSettings: vi.fn(),
  getDownloadUrl: vi.fn(),
}));

// Mock socket hook to avoid real socket connections
vi.mock('../hooks/useSocket', () => ({
  useSocket: vi.fn(),
}));

import {
  getClipboardItems,
  deleteClipboardItem,
  updateClipboardItem,
  batchOperation,
  getSystemSettings,
} from '../services/api';

const mockedGetClipboardItems = vi.mocked(getClipboardItems);
const mockedDeleteClipboardItem = vi.mocked(deleteClipboardItem);
const mockedUpdateClipboardItem = vi.mocked(updateClipboardItem);
const mockedBatchOperation = vi.mocked(batchOperation);
const mockedGetSystemSettings = vi.mocked(getSystemSettings);

function makeItem(overrides: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    id: 'item-1',
    userId: 'user-1',
    type: 'text',
    content: 'archived text',
    fileName: null,
    fileSize: null,
    mimeType: null,
    storageKey: null,
    uploadStatus: null,
    s3UploadId: null,
    status: 'archived',
    isPublic: false,
    isFavorite: false,
    shareToken: null,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePaginatedResponse(items: ClipboardItem[]) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 12,
    totalPages: 1,
  };
}

function renderArchivePage() {
  return render(
    <MemoryRouter initialEntries={['/archive']}>
      <ArchivePage />
    </MemoryRouter>,
  );
}

describe('ArchivePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSystemSettings.mockResolvedValue({});
  });

  it('renders the Archive heading', async () => {
    mockedGetClipboardItems.mockResolvedValue(makePaginatedResponse([]));

    renderArchivePage();

    await waitFor(() => {
      expect(screen.getByText('Archive')).toBeInTheDocument();
    });
  });

  it('shows "kept indefinitely" when no retentionDays in settings', async () => {
    mockedGetClipboardItems.mockResolvedValue(makePaginatedResponse([]));
    mockedGetSystemSettings.mockResolvedValue({});

    renderArchivePage();

    await waitFor(() => {
      expect(screen.getByText(/kept indefinitely/i)).toBeInTheDocument();
    });
  });

  it('shows retention days from system settings', async () => {
    mockedGetClipboardItems.mockResolvedValue(makePaginatedResponse([]));
    mockedGetSystemSettings.mockResolvedValue({ 'retention.deleteAfterArchiveDays': 30 });

    renderArchivePage();

    await waitFor(() => {
      expect(screen.getByText(/30 days/i)).toBeInTheDocument();
    });
  });

  it('renders archived items', async () => {
    const items = [
      makeItem({ id: '1', content: 'First archived item' }),
      makeItem({ id: '2', content: 'Second archived item' }),
    ];
    mockedGetClipboardItems.mockResolvedValue(makePaginatedResponse(items));

    renderArchivePage();

    await waitFor(() => {
      expect(screen.getByText('First archived item')).toBeInTheDocument();
      expect(screen.getByText('Second archived item')).toBeInTheDocument();
    });
  });

  it('shows empty archive message when no items', async () => {
    mockedGetClipboardItems.mockResolvedValue(makePaginatedResponse([]));

    renderArchivePage();

    await waitFor(() => {
      expect(screen.getByText('Archive is empty.')).toBeInTheDocument();
    });
  });

  it('shows "Empty Archive" button when items are present', async () => {
    mockedGetClipboardItems.mockResolvedValue(makePaginatedResponse([makeItem()]));

    renderArchivePage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /empty archive/i })).toBeInTheDocument();
    });
  });

  it('does not show "Empty Archive" button when archive is empty', async () => {
    mockedGetClipboardItems.mockResolvedValue(makePaginatedResponse([]));

    renderArchivePage();

    await waitFor(() => {
      // Wait for loading to complete
      expect(screen.getByText('Archive is empty.')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /empty archive/i })).not.toBeInTheDocument();
  });

  it('shows confirmation dialog when "Empty Archive" is clicked', async () => {
    mockedGetClipboardItems.mockResolvedValue(makePaginatedResponse([makeItem()]));

    renderArchivePage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /empty archive/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /empty archive/i }));

    expect(screen.getByRole('heading', { name: 'Empty Archive' })).toBeInTheDocument();
    expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete all/i })).toBeInTheDocument();
  });

  it('calls batchOperation with delete when confirming empty archive', async () => {
    const items = [makeItem({ id: '1' }), makeItem({ id: '2' })];
    mockedGetClipboardItems.mockResolvedValue(makePaginatedResponse(items));
    mockedBatchOperation.mockResolvedValue({ count: 2 });

    renderArchivePage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /empty archive/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /empty archive/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete all/i }));

    await waitFor(() => {
      expect(mockedBatchOperation).toHaveBeenCalledWith(['1', '2'], 'delete');
    });
  });

  it('calls updateClipboardItem with status:active when Restore is clicked', async () => {
    const item = makeItem({ id: 'restore-me' });
    mockedGetClipboardItems.mockResolvedValue(makePaginatedResponse([item]));
    mockedUpdateClipboardItem.mockResolvedValue({ ...item, status: 'active' });

    renderArchivePage();

    await waitFor(() => {
      expect(screen.getByText('archived text')).toBeInTheDocument();
    });

    // Restore button is first in archive mode card actions (Unarchive icon)
    const buttons = screen.getAllByRole('button');
    // Find the restore button (Unarchive tooltip)
    const restoreButton = buttons.find((btn) => {
      return btn.querySelector('[data-testid="UnarchiveIcon"]') !== null ||
        btn.closest('[title="Restore to clipboard"]') !== null;
    });

    // Click first restore button (index may vary by card; use tooltip approach)
    const allButtons = screen.getAllByRole('button');
    // First archive-mode card: Restore is first, Delete is second in CardActions
    // Find by looking at buttons without count constraints
    fireEvent.click(allButtons.find((b) => b.innerHTML.includes('UnarchiveIcon') || b.innerHTML.includes('Unarchive')) ?? allButtons[0]);

    await waitFor(() => {
      expect(mockedUpdateClipboardItem).toHaveBeenCalledWith('restore-me', { status: 'active' });
    });
  });

  it('calls deleteClipboardItem when permanent delete is clicked', async () => {
    const item = makeItem({ id: 'delete-me' });
    mockedGetClipboardItems.mockResolvedValue(makePaginatedResponse([item]));
    mockedDeleteClipboardItem.mockResolvedValue(undefined);

    renderArchivePage();

    await waitFor(() => {
      expect(screen.getByText('archived text')).toBeInTheDocument();
    });

    // Archive mode card: Restore button (index 0), Delete permanently (index 1)
    const allButtons = screen.getAllByRole('button');
    // Click the last button in the card actions (delete permanently = last button on card)
    // The type filter chips also render, so find card-specific buttons
    // Buttons order: type chips (Chips are not buttons), then card buttons
    // Filter buttons = no chips; look for last 2 which are restore + delete
    const actionButtons = allButtons.filter(
      (b) => !b.classList.contains('MuiChip-root'),
    );
    // Last actionButton is delete permanently
    fireEvent.click(actionButtons[actionButtons.length - 1]);

    await waitFor(() => {
      expect(mockedDeleteClipboardItem).toHaveBeenCalledWith('delete-me');
    });
  });

  it('shows type filter chips', async () => {
    mockedGetClipboardItems.mockResolvedValue(makePaginatedResponse([]));

    renderArchivePage();

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
      expect(screen.getByText('Images')).toBeInTheDocument();
      expect(screen.getByText('Files')).toBeInTheDocument();
      expect(screen.getByText('Media')).toBeInTheDocument();
    });
  });

  it('calls batchOperation restore for selected items', async () => {
    const items = [
      makeItem({ id: 'sel-1', content: 'Item one' }),
      makeItem({ id: 'sel-2', content: 'Item two' }),
    ];
    mockedGetClipboardItems.mockResolvedValue(makePaginatedResponse(items));
    mockedBatchOperation.mockResolvedValue({ count: 2 });

    renderArchivePage();

    await waitFor(() => {
      expect(screen.getByText('Item one')).toBeInTheDocument();
    });

    // Click checkboxes to select items
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    await waitFor(() => {
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /restore selected/i }));

    await waitFor(() => {
      expect(mockedBatchOperation).toHaveBeenCalledWith(['sel-1', 'sel-2'], 'restore');
    });
  });
});
