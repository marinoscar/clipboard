import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useClipboard } from './useClipboard';
import type { ClipboardItem, PaginatedResponse } from '../types';

vi.mock('../services/api', () => ({
  getClipboardItems: vi.fn(),
  deleteClipboardItem: vi.fn(),
}));

import { getClipboardItems, deleteClipboardItem } from '../services/api';

const mockedGetClipboardItems = vi.mocked(getClipboardItems);
const mockedDeleteClipboardItem = vi.mocked(deleteClipboardItem);

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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePagedResponse(
  items: ClipboardItem[],
  overrides: Partial<PaginatedResponse<ClipboardItem>> = {},
): PaginatedResponse<ClipboardItem> {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    ...overrides,
  };
}

describe('useClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', async () => {
    // Never resolves during this check — keeps the hook loading
    mockedGetClipboardItems.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useClipboard());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
  });

  it('should fetch items on mount and set items state', async () => {
    const items = [makeItem({ id: 'item-1' }), makeItem({ id: 'item-2' })];
    mockedGetClipboardItems.mockResolvedValue(makePagedResponse(items, { total: 2 }));

    const { result } = renderHook(() => useClipboard());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toEqual(items);
    expect(result.current.total).toBe(2);
    expect(mockedGetClipboardItems).toHaveBeenCalledWith({ page: 1 });
  });

  it('should handle fetch error', async () => {
    mockedGetClipboardItems.mockRejectedValue(new Error('Network failure'));

    const { result } = renderHook(() => useClipboard());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network failure');
    expect(result.current.items).toEqual([]);
  });

  it('should wrap non-Error rejections in an Error', async () => {
    mockedGetClipboardItems.mockRejectedValue('string error');

    const { result } = renderHook(() => useClipboard());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to fetch items');
  });

  it('loadMore fetches next page and appends items', async () => {
    const page1Items = [makeItem({ id: 'item-1' }), makeItem({ id: 'item-2' })];
    const page2Items = [makeItem({ id: 'item-3' })];

    mockedGetClipboardItems
      .mockResolvedValueOnce(makePagedResponse(page1Items, { total: 3, totalPages: 2 }))
      .mockResolvedValueOnce(
        makePagedResponse(page2Items, { page: 2, total: 3, totalPages: 2 }),
      );

    const { result } = renderHook(() => useClipboard());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toHaveLength(3);
    expect(result.current.items[2].id).toBe('item-3');
    expect(mockedGetClipboardItems).toHaveBeenCalledTimes(2);
    expect(mockedGetClipboardItems).toHaveBeenLastCalledWith({ page: 2 });
  });

  it('loadMore does nothing when there are no more pages', async () => {
    const items = [makeItem()];
    mockedGetClipboardItems.mockResolvedValue(
      makePagedResponse(items, { total: 1, totalPages: 1 }),
    );

    const { result } = renderHook(() => useClipboard());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(false);

    await act(async () => {
      result.current.loadMore();
    });

    // Still only one API call (the initial mount)
    expect(mockedGetClipboardItems).toHaveBeenCalledTimes(1);
  });

  it('removeItem calls deleteClipboardItem and removes the item from state', async () => {
    const items = [makeItem({ id: 'item-1' }), makeItem({ id: 'item-2' })];
    mockedGetClipboardItems.mockResolvedValue(makePagedResponse(items, { total: 2 }));
    mockedDeleteClipboardItem.mockResolvedValue(undefined);

    const { result } = renderHook(() => useClipboard());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(2);

    await act(async () => {
      await result.current.removeItem('item-1');
    });

    expect(mockedDeleteClipboardItem).toHaveBeenCalledWith('item-1');
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('item-2');
    expect(result.current.total).toBe(1);
  });

  it('addItem prepends item to state and increments total', async () => {
    const existing = makeItem({ id: 'existing' });
    mockedGetClipboardItems.mockResolvedValue(makePagedResponse([existing], { total: 1 }));

    const { result } = renderHook(() => useClipboard());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(1);

    const newItem = makeItem({ id: 'new-item', content: 'brand new' });

    act(() => {
      result.current.addItem(newItem);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].id).toBe('new-item');
    expect(result.current.items[1].id).toBe('existing');
    expect(result.current.total).toBe(2);
  });

  it('re-fetches when query changes', async () => {
    mockedGetClipboardItems.mockResolvedValue(makePagedResponse([]));

    const { rerender } = renderHook(
      ({ query }) => useClipboard(query),
      { initialProps: { query: { type: 'text' as const } } },
    );

    await waitFor(() =>
      expect(mockedGetClipboardItems).toHaveBeenCalledWith({ type: 'text', page: 1 }),
    );

    mockedGetClipboardItems.mockResolvedValue(makePagedResponse([]));

    rerender({ query: { type: 'file' as const } });

    await waitFor(() =>
      expect(mockedGetClipboardItems).toHaveBeenCalledWith({ type: 'file', page: 1 }),
    );

    expect(mockedGetClipboardItems).toHaveBeenCalledTimes(2);
  });
});
