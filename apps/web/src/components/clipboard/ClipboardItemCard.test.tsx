import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClipboardItemCard } from './ClipboardItemCard';
import type { ClipboardItem } from '../../types';

vi.mock('../../services/api', () => ({
  getDownloadUrl: vi.fn(),
}));

import { getDownloadUrl } from '../../services/api';

const mockedGetDownloadUrl = vi.mocked(getDownloadUrl);

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
    status: 'active',
    isPublic: false,
    shareToken: null,
    // Use a fixed past date so formatRelativeTime returns a stable result
    createdAt: new Date(Date.now() - 60 * 1000).toISOString(), // 1 minute ago
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ClipboardItemCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('text items', () => {
    it('renders text item with content preview', () => {
      const item = makeItem({ content: 'This is some text content' });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      expect(screen.getByText('This is some text content')).toBeInTheDocument();
    });

    it('truncates text content to 200 chars and appends ellipsis', () => {
      const longText = 'A'.repeat(250);
      const item = makeItem({ content: longText });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      // The component slices to 200 chars and appends "…"
      expect(screen.getByText('A'.repeat(200) + '…')).toBeInTheDocument();
    });

    it('does not append ellipsis for content of 200 chars or fewer', () => {
      const text = 'A'.repeat(200);
      const item = makeItem({ content: text });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      expect(screen.getByText('A'.repeat(200))).toBeInTheDocument();
      // The "…" character should not be present as a separate element
      expect(screen.queryByText('A'.repeat(200) + '…')).not.toBeInTheDocument();
    });

    it('shows Copy button for text items', () => {
      render(<ClipboardItemCard item={makeItem()} onDelete={vi.fn()} />);
      // IconButton is wrapped in a Tooltip — query by aria-label or by the button role
      const buttons = screen.getAllByRole('button');
      // Copy and Delete buttons
      expect(buttons).toHaveLength(2);
    });

    it('does not show Download button for text items', () => {
      render(<ClipboardItemCard item={makeItem()} onDelete={vi.fn()} />);
      expect(screen.queryByTitle('Download')).not.toBeInTheDocument();
    });

    it('shows type chip with label "text"', () => {
      render(<ClipboardItemCard item={makeItem()} onDelete={vi.fn()} />);
      expect(screen.getByText('text')).toBeInTheDocument();
    });
  });

  describe('file items', () => {
    it('renders file item with filename', () => {
      const item = makeItem({ type: 'file', fileName: 'report.pdf', fileSize: 1024 });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    it('renders formatted file size', () => {
      const item = makeItem({ type: 'file', fileName: 'data.zip', fileSize: 1536 }); // 1.5 KB
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      expect(screen.getByText(/1\.5 KB/)).toBeInTheDocument();
    });

    it('shows Download button for file items', () => {
      const item = makeItem({ type: 'file', fileName: 'doc.pdf', fileSize: 500 });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      // Download + Delete buttons
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });

    it('does not show Copy button for file items', () => {
      const item = makeItem({ type: 'file', fileName: 'doc.pdf' });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      const buttons = screen.getAllByRole('button');
      // Only Download and Delete
      expect(buttons).toHaveLength(2);
    });

    it('shows type chip with label "file"', () => {
      const item = makeItem({ type: 'file', fileName: 'x.bin' });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      expect(screen.getByText('file')).toBeInTheDocument();
    });
  });

  describe('image items', () => {
    it('renders image item with filename', () => {
      const item = makeItem({ type: 'image', fileName: 'photo.png', fileSize: 2048 });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      expect(screen.getByText('photo.png')).toBeInTheDocument();
    });

    it('renders formatted image file size', () => {
      const item = makeItem({ type: 'image', fileName: 'photo.png', fileSize: 1048576 }); // 1.0 MB
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      expect(screen.getByText(/1\.0 MB/)).toBeInTheDocument();
    });

    it('shows type chip with label "image"', () => {
      const item = makeItem({ type: 'image', fileName: 'img.jpg' });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      expect(screen.getByText('image')).toBeInTheDocument();
    });

    it('shows Download button for image items', () => {
      const item = makeItem({ type: 'image', fileName: 'img.jpg' });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });
  });

  describe('media items', () => {
    it('renders media item with filename', () => {
      const item = makeItem({
        type: 'media',
        fileName: 'video.mp4',
        fileSize: 10485760,
        mimeType: 'video/mp4',
      });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      expect(screen.getByText('video.mp4')).toBeInTheDocument();
    });

    it('shows type chip with label "media"', () => {
      const item = makeItem({ type: 'media', fileName: 'clip.mp4', mimeType: 'video/mp4' });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      expect(screen.getByText('media')).toBeInTheDocument();
    });

    it('shows Download button for media items', () => {
      const item = makeItem({ type: 'media', fileName: 'audio.mp3', mimeType: 'audio/mpeg' });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });
  });

  describe('delete button', () => {
    it('shows Delete button for all item types', () => {
      const types: ClipboardItem['type'][] = ['text', 'file', 'image', 'media'];

      for (const type of types) {
        const item = makeItem({ type, fileName: type !== 'text' ? 'x' : null });
        const { unmount } = render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);
        const buttons = screen.getAllByRole('button');
        // At least one button (Delete) is always present
        expect(buttons.length).toBeGreaterThanOrEqual(1);
        unmount();
      }
    });

    it('calls onDelete with item id when Delete is clicked', () => {
      const onDelete = vi.fn();
      const item = makeItem({ id: 'delete-me' });
      render(<ClipboardItemCard item={item} onDelete={onDelete} />);

      // Delete button is always last
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[buttons.length - 1];
      fireEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledWith('delete-me');
    });
  });

  describe('relative time', () => {
    it('shows "just now" for items created within 30 seconds', () => {
      const item = makeItem({ createdAt: new Date(Date.now() - 10 * 1000).toISOString() });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      expect(screen.getByText('just now')).toBeInTheDocument();
    });

    it('shows seconds ago for items created between 30 and 60 seconds ago', () => {
      const item = makeItem({ createdAt: new Date(Date.now() - 45 * 1000).toISOString() });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      expect(screen.getByText(/s ago/)).toBeInTheDocument();
    });

    it('shows minutes ago for items created less than an hour ago', () => {
      const item = makeItem({ createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      expect(screen.getByText('5 min ago')).toBeInTheDocument();
    });
  });

  describe('download button', () => {
    it('calls getDownloadUrl and opens new window when Download is clicked', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      mockedGetDownloadUrl.mockResolvedValue({ url: 'https://s3.example.com/file' });

      const item = makeItem({ type: 'file', fileName: 'doc.pdf' });
      render(<ClipboardItemCard item={item} onDelete={vi.fn()} />);

      const buttons = screen.getAllByRole('button');
      // Download is first, Delete is second
      fireEvent.click(buttons[0]);

      await waitFor(() => {
        expect(mockedGetDownloadUrl).toHaveBeenCalledWith(item.id);
        expect(openSpy).toHaveBeenCalledWith(
          'https://s3.example.com/file',
          '_blank',
          'noopener,noreferrer',
        );
      });

      openSpy.mockRestore();
    });
  });
});
