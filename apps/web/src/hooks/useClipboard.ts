import { useState, useEffect, useCallback } from 'react';
import { ClipboardItem, ClipboardQuery, PaginatedResponse } from '../types';
import { getClipboardItems, deleteClipboardItem } from '../services/api';

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

  const addItem = useCallback((item: ClipboardItem) => {
    setItems((prev) => [item, ...prev]);
    setTotal((prev) => prev + 1);
  }, []);

  return {
    items,
    isLoading,
    error,
    hasMore: page < totalPages,
    total,
    refresh,
    loadMore,
    removeItem,
    addItem,
  };
}
