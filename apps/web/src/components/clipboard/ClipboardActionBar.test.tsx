import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClipboardActionBar } from './ClipboardActionBar';
import type { ClipboardItem } from '../../types';

vi.mock('../../services/api', () => ({
  createTextItem: vi.fn(),
}));

import { createTextItem } from '../../services/api';

const mockedCreateTextItem = vi.mocked(createTextItem);

function makeItem(overrides: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    id: 'item-1',
    userId: 'user-1',
    type: 'text',
    content: 'hello',
    fileName: null,
    fileSize: null,
    mimeType: null,
    storageKey: null,
    uploadStatus: null,
    s3UploadId: null,
    status: 'active',
    isPublic: false,
    shareToken: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Restore navigator.clipboard after each test so mocks do not leak.
let originalClipboard: Clipboard;

beforeEach(() => {
  vi.clearAllMocks();
  originalClipboard = navigator.clipboard;
});

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: originalClipboard,
    writable: true,
    configurable: true,
  });
});

describe('ClipboardActionBar', () => {
  it('renders Upload and Paste buttons', () => {
    render(
      <ClipboardActionBar onFileSelected={vi.fn()} onItemCreated={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /paste/i })).toBeInTheDocument();
  });

  it('clicking Paste reads from clipboard, calls createTextItem, then calls onItemCreated', async () => {
    const clipboardText = 'pasted text content';
    const createdItem = makeItem({ content: clipboardText });

    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: vi.fn().mockResolvedValue(clipboardText) },
      writable: true,
      configurable: true,
    });

    mockedCreateTextItem.mockResolvedValue(createdItem);

    const onItemCreated = vi.fn();
    render(
      <ClipboardActionBar onFileSelected={vi.fn()} onItemCreated={onItemCreated} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /paste/i }));

    await waitFor(() => {
      expect(navigator.clipboard.readText).toHaveBeenCalled();
      expect(mockedCreateTextItem).toHaveBeenCalledWith(clipboardText);
      expect(onItemCreated).toHaveBeenCalledWith(createdItem);
    });
  });

  it('shows error snackbar when clipboard API is not available', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(
      <ClipboardActionBar onFileSelected={vi.fn()} onItemCreated={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /paste/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/clipboard api not available/i),
      ).toBeInTheDocument();
    });
  });

  it('shows error snackbar when clipboard is empty', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: vi.fn().mockResolvedValue('') },
      writable: true,
      configurable: true,
    });

    render(
      <ClipboardActionBar onFileSelected={vi.fn()} onItemCreated={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /paste/i }));

    await waitFor(() => {
      expect(screen.getByText(/clipboard is empty/i)).toBeInTheDocument();
    });
  });

  it('shows permission-denied error when readText throws NotAllowedError', async () => {
    const permissionError = new Error('Permission denied');
    permissionError.name = 'NotAllowedError';
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: vi.fn().mockRejectedValue(permissionError) },
      writable: true,
      configurable: true,
    });

    render(
      <ClipboardActionBar onFileSelected={vi.fn()} onItemCreated={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /paste/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/clipboard permission denied/i),
      ).toBeInTheDocument();
    });
  });

  it('shows generic error snackbar when createTextItem rejects', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: vi.fn().mockResolvedValue('some text') },
      writable: true,
      configurable: true,
    });

    mockedCreateTextItem.mockRejectedValue(new Error('Network failure'));

    render(
      <ClipboardActionBar onFileSelected={vi.fn()} onItemCreated={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /paste/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/failed to paste from clipboard/i),
      ).toBeInTheDocument();
    });
  });

  it('calls onFileSelected for each file chosen via the file input', async () => {
    const onFileSelected = vi.fn();
    render(
      <ClipboardActionBar onFileSelected={onFileSelected} onItemCreated={vi.fn()} />,
    );

    const file1 = new File(['a'], 'a.txt', { type: 'text/plain' });
    const file2 = new File(['b'], 'b.png', { type: 'image/png' });

    // The hidden <input type="file"> is the first one in the DOM.
    const fileInput = document
      .querySelectorAll('input[type="file"]')[0] as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    expect(onFileSelected).toHaveBeenCalledTimes(2);
    expect(onFileSelected).toHaveBeenNthCalledWith(1, file1);
    expect(onFileSelected).toHaveBeenNthCalledWith(2, file2);
  });
});
