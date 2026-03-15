import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ClipboardInput } from './ClipboardInput';
import type { ClipboardItem } from '../../types';

// Mock the entire api module so uploadFile is controllable
vi.mock('../../services/api', () => ({
  uploadFile: vi.fn(),
}));

import { uploadFile } from '../../services/api';

const mockedUploadFile = vi.mocked(uploadFile);

function makeItem(overrides: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    id: 'item-1',
    userId: 'user-1',
    type: 'file',
    content: null,
    fileName: 'file.txt',
    fileSize: 1024,
    mimeType: 'text/plain',
    storageKey: null,
    status: 'active',
    isPublic: false,
    shareToken: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ClipboardInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders drop zone instruction text', () => {
    render(<ClipboardInput onItemCreated={vi.fn()} />);

    expect(
      screen.getByText('Paste anything (Ctrl+V) or drop files here'),
    ).toBeInTheDocument();
  });

  it('renders "Choose Files" button', () => {
    render(<ClipboardInput onItemCreated={vi.fn()} />);

    expect(screen.getByRole('button', { name: /choose files/i })).toBeInTheDocument();
  });

  it('shows loading state during upload', async () => {
    // Return a promise that never resolves so the component stays in the uploading state
    mockedUploadFile.mockReturnValue(new Promise(() => {}));

    const onItemCreated = vi.fn();
    render(<ClipboardInput onItemCreated={onItemCreated} />);

    const dropZone = screen.getByText('Paste anything (Ctrl+V) or drop files here').closest(
      '[class*="MuiPaper"]',
    ) as HTMLElement;

    const file = new File(['content'], 'test.txt', { type: 'text/plain' });

    await act(async () => {
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
          items: [
            {
              kind: 'file',
              type: file.type,
              getAsFile: () => file,
            },
          ],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });
  });

  it('handles file drop: calls uploadFile and invokes onItemCreated', async () => {
    const uploadedItem = makeItem({ id: 'dropped-item' });
    mockedUploadFile.mockResolvedValue(uploadedItem);

    const onItemCreated = vi.fn();
    render(<ClipboardInput onItemCreated={onItemCreated} />);

    const dropZone = screen
      .getByText('Paste anything (Ctrl+V) or drop files here')
      .closest('[class*="MuiPaper"]') as HTMLElement;

    const file = new File(['data'], 'dropped.txt', { type: 'text/plain' });

    await act(async () => {
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
          items: [
            {
              kind: 'file',
              type: file.type,
              getAsFile: () => file,
            },
          ],
        },
      });
    });

    await waitFor(() => {
      expect(mockedUploadFile).toHaveBeenCalledWith(file);
      expect(onItemCreated).toHaveBeenCalledWith(uploadedItem);
    });
  });

  it('shows "Drop files here" text during drag-over', () => {
    render(<ClipboardInput onItemCreated={vi.fn()} />);

    const dropZone = screen
      .getByText('Paste anything (Ctrl+V) or drop files here')
      .closest('[class*="MuiPaper"]') as HTMLElement;

    fireEvent.dragEnter(dropZone, { relatedTarget: null });

    expect(screen.getByText('Drop files here')).toBeInTheDocument();
  });

  it('shows upload error message when upload fails', async () => {
    mockedUploadFile.mockRejectedValue(new Error('Server error'));

    render(<ClipboardInput onItemCreated={vi.fn()} />);

    const dropZone = screen
      .getByText('Paste anything (Ctrl+V) or drop files here')
      .closest('[class*="MuiPaper"]') as HTMLElement;

    const file = new File(['data'], 'bad.txt', { type: 'text/plain' });

    await act(async () => {
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
          items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/upload failed: server error/i)).toBeInTheDocument();
    });
  });

  it('does not call uploadFile when drop has no files', async () => {
    render(<ClipboardInput onItemCreated={vi.fn()} />);

    const dropZone = screen
      .getByText('Paste anything (Ctrl+V) or drop files here')
      .closest('[class*="MuiPaper"]') as HTMLElement;

    await act(async () => {
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [], items: [] },
      });
    });

    expect(mockedUploadFile).not.toHaveBeenCalled();
  });
});
