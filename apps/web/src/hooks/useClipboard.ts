import { useState, useEffect, useCallback } from 'react';
import { ClipboardItem, ClipboardQuery, PaginatedResponse } from '../types';
import { getClipboardItems, deleteClipboardItem, updateClipboardItem } from '../services/api';
import { useSocket } from './useSocket';

/** Sort items newest-first by createdAt */
function sortNewestFirst(items: ClipboardItem[]): ClipboardItem[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function useClipboard(query?: ClipboardQuery) {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(query?.page || 1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchItems = useCallback(
    async (pageNum: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const result: PaginatedResponse<ClipboardItem> = await getClipboardItems({
          ...query,
          page: pageNum,
        });
        if (pageNum === 1) {
          setItems(result.items);
        } else {
          setItems((prev) => [...prev, ...result.items]);
        }
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setPage(pageNum);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch items'));
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(query)],
  );

  useEffect(() => {
    fetchItems(1);
  }, [fetchItems]);

  const refresh = useCallback(() => fetchItems(1), [fetchItems]);

  const loadMore = useCallback(() => {
    if (page < totalPages) fetchItems(page + 1);
  }, [page, totalPages, fetchItems]);

  const removeItem = useCallback(async (id: string) => {
    await deleteClipboardItem(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    setTotal((prev) => prev - 1);
  }, []);

  const archiveItem = useCallback(async (id: string) => {
    await updateClipboardItem(id, { status: 'archived' });
    setItems((prev) => prev.filter((item) => item.id !== id));
    setTotal((prev) => prev - 1);
  }, []);

  const restoreItem = useCallback(async (id: string) => {
    await updateClipboardItem(id, { status: 'active' });
    setItems((prev) => prev.filter((item) => item.id !== id));
    setTotal((prev) => prev - 1);
  }, []);

  const addItem = useCallback((item: ClipboardItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      setTotal((t) => t + 1);
      return sortNewestFirst([item, ...prev]);
    });
  }, []);

  const updateItem = useCallback((item: ClipboardItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  }, []);

  // Real-time socket event handlers
  const handleItemCreated = useCallback((item: ClipboardItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      return sortNewestFirst([item, ...prev]);
    });
    setTotal((prev) => prev + 1);
  }, []);

  const handleItemUpdated = useCallback((item: ClipboardItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  }, []);

  const handleItemDeleted = useCallback(({ id }: { id: string }) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === id);
      if (!exists) return prev;
      setTotal((t) => t - 1);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  useSocket('item:created', handleItemCreated);
  useSocket('item:updated', handleItemUpdated);
  useSocket('item:deleted', handleItemDeleted);

  return {
    items,
    isLoading,
    error,
    hasMore: page < totalPages,
    total,
    refresh,
    loadMore,
    removeItem,
    archiveItem,
    restoreItem,
    addItem,
    updateItem,
  };
}
