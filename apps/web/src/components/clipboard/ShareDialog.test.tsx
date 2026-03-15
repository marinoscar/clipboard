import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareDialog } from './ShareDialog';
import type { ClipboardItem } from '../../types';

vi.mock('../../services/api', () => ({
  enableSharing: vi.fn(),
  disableSharing: vi.fn(),
}));

import { enableSharing, disableSharing } from '../../services/api';

const mockedEnableSharing = vi.mocked(enableSharing);
const mockedDisableSharing = vi.mocked(disableSharing);

function makeItem(overrides: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    id: 'item-1',
    userId: 'user-1',
    type: 'text',
    content: 'hello world',
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

describe('ShareDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // mock clipboard API
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders the dialog when open is true', () => {
    render(
      <ShareDialog
        open={true}
        onClose={vi.fn()}
        item={makeItem()}
        onItemUpdated={vi.fn()}
      />,
    );

    expect(screen.getByText('Share Item')).toBeInTheDocument();
  });

  it('does not render dialog content when open is false', () => {
    render(
      <ShareDialog
        open={false}
        onClose={vi.fn()}
        item={makeItem()}
        onItemUpdated={vi.fn()}
      />,
    );

    expect(screen.queryByText('Share Item')).not.toBeInTheDocument();
  });

  it('shows Private label when item is not public', () => {
    render(
      <ShareDialog
        open={true}
        onClose={vi.fn()}
        item={makeItem({ isPublic: false })}
        onItemUpdated={vi.fn()}
      />,
    );

    expect(screen.getByText(/Private/)).toBeInTheDocument();
  });

  it('shows Public label and share URL when item is public', () => {
    const item = makeItem({ isPublic: true, shareToken: 'abc123' });
    render(
      <ShareDialog
        open={true}
        onClose={vi.fn()}
        item={item}
        onItemUpdated={vi.fn()}
      />,
    );

    expect(screen.getByText(/Public/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/\/share\/abc123/)).toBeInTheDocument();
  });

  it('calls enableSharing and onItemUpdated when toggle is switched on', async () => {
    mockedEnableSharing.mockResolvedValue({ shareToken: 'tok-1', shareUrl: 'http://localhost/share/tok-1' });

    const onItemUpdated = vi.fn();
    const item = makeItem({ isPublic: false });

    render(
      <ShareDialog
        open={true}
        onClose={vi.fn()}
        item={item}
        onItemUpdated={onItemUpdated}
      />,
    );

    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockedEnableSharing).toHaveBeenCalledWith('item-1');
      expect(onItemUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ isPublic: true, shareToken: 'tok-1' }),
      );
    });
  });

  it('calls disableSharing and onItemUpdated when toggle is switched off', async () => {
    mockedDisableSharing.mockResolvedValue(undefined);

    const onItemUpdated = vi.fn();
    const item = makeItem({ isPublic: true, shareToken: 'tok-existing' });

    render(
      <ShareDialog
        open={true}
        onClose={vi.fn()}
        item={item}
        onItemUpdated={onItemUpdated}
      />,
    );

    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockedDisableSharing).toHaveBeenCalledWith('item-1');
      expect(onItemUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ isPublic: false, shareToken: null }),
      );
    });
  });

  it('shows error alert when enableSharing fails', async () => {
    mockedEnableSharing.mockRejectedValue(new Error('Network error'));

    render(
      <ShareDialog
        open={true}
        onClose={vi.fn()}
        item={makeItem({ isPublic: false })}
        onItemUpdated={vi.fn()}
      />,
    );

    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <ShareDialog
        open={true}
        onClose={onClose}
        item={makeItem()}
        onItemUpdated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls navigator.clipboard.writeText when copy button is clicked', async () => {
    const item = makeItem({ isPublic: true, shareToken: 'tok-copy' });

    render(
      <ShareDialog
        open={true}
        onClose={vi.fn()}
        item={item}
        onItemUpdated={vi.fn()}
      />,
    );

    const copyButton = screen.getByRole('button', { name: /copy share url/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/share/tok-copy'),
      );
    });
  });
});
