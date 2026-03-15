import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import ContentPaste from '@mui/icons-material/ContentPaste';
import { ClipboardItem } from '../../types';
import { ClipboardItemCard } from './ClipboardItemCard';

interface ClipboardItemListProps {
  items: ClipboardItem[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onDelete: (id: string) => void;
  onItemClick?: (item: ClipboardItem) => void;
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
  onItemClick,
}: ClipboardItemListProps) {
  if (!isLoading && items.length === 0) {
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
        <ContentPaste sx={{ fontSize: 64 }} />
        <Typography variant="h6" color="text.disabled">
          No items yet. Paste something!
        </Typography>
        <Typography variant="body2" color="text.disabled">
          Press Ctrl+V anywhere on this page, or drop files into the zone above.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Grid container spacing={2}>
        {items.map((item) => (
          <Grid item key={item.id} xs={12} sm={6} md={4}>
            <ClipboardItemCard item={item} onDelete={onDelete} onClick={onItemClick} />
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
