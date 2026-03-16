import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import ContentPaste from '@mui/icons-material/ContentPaste';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import { ClipboardItem } from '../../types';
import { ClipboardItemCard, CardMode } from './ClipboardItemCard';

interface ClipboardItemListProps {
  items: ClipboardItem[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onItemClick?: (item: ClipboardItem) => void;
  onItemUpdated?: (item: ClipboardItem) => void;
  mode?: CardMode;
  selectedIds?: Set<string>;
  onSelectItem?: (id: string) => void;
  selectionMode?: boolean;
  emptyMessage?: string;
  emptySubMessage?: string;
}

function SkeletonCard() {
  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Skeleton variant="rounded" width={70} height={24} />
          <Skeleton variant="text" width={60} />
        </Box>
        <Skeleton variant="text" />
        <Skeleton variant="text" />
        <Skeleton variant="text" width="60%" />
      </CardContent>
    </Card>
  );
}

export function ClipboardItemList({
  items,
  isLoading,
  hasMore,
  onLoadMore,
  onDelete,
  onRestore,
  onItemClick,
  onItemUpdated,
  mode = 'clipboard',
  selectedIds,
  onSelectItem,
  selectionMode = false,
  emptyMessage,
  emptySubMessage,
}: ClipboardItemListProps) {
  if (!isLoading && items.length === 0) {
    const isArchiveMode = mode === 'archive';
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          gap: 2,
          color: 'text.disabled',
        }}
      >
        {isArchiveMode ? (
          <Inventory2Outlined sx={{ fontSize: 64 }} />
        ) : (
          <ContentPaste sx={{ fontSize: 64 }} />
        )}
        <Typography variant="h6" color="text.disabled">
          {emptyMessage ?? (isArchiveMode ? 'Archive is empty.' : 'No items yet. Paste something!')}
        </Typography>
        {(emptySubMessage !== undefined || !isArchiveMode) && (
          <Typography variant="body2" color="text.disabled">
            {emptySubMessage ??
              'Press Ctrl+V anywhere on this page, or drop files into the zone above.'}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Grid container spacing={2}>
        {items.map((item) => (
          <Grid item key={item.id} xs={12} sm={6} md={4}>
            <ClipboardItemCard
              item={item}
              onDelete={onDelete}
              onRestore={onRestore}
              onClick={onItemClick}
              onItemUpdated={onItemUpdated}
              mode={mode}
              selected={selectedIds?.has(item.id) ?? false}
              selectionMode={selectionMode}
              onSelect={onSelectItem}
            />
          </Grid>
        ))}

        {/* Skeleton cards while loading */}
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Grid item key={`skeleton-${i}`} xs={12} sm={6} md={4}>
              <SkeletonCard />
            </Grid>
          ))}
      </Grid>

      {hasMore && !isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Button variant="outlined" onClick={onLoadMore}>
            Load More
          </Button>
        </Box>
      )}
    </Box>
  );
}
