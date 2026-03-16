import { useState, useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Inventory2 from '@mui/icons-material/Inventory2';
import Unarchive from '@mui/icons-material/Unarchive';
import DeleteForever from '@mui/icons-material/DeleteForever';
import DeleteSweep from '@mui/icons-material/DeleteSweep';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { ClipboardItem, ClipboardQuery } from '../types';
import { useClipboard } from '../hooks/useClipboard';
import { batchOperation, getSystemSettings } from '../services/api';
import { ClipboardItemList } from '../components/clipboard/ClipboardItemList';
import { TextItemView } from '../components/clipboard/TextItemView';
import { FileItemView } from '../components/clipboard/FileItemView';
import { SelectionBar } from '../components/clipboard/SelectionBar';

type TypeFilter = 'all' | 'text' | 'image' | 'file' | 'media';

const TYPE_FILTERS: { label: string; value: TypeFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Text', value: 'text' },
  { label: 'Images', value: 'image' },
  { label: 'Files', value: 'file' },
  { label: 'Media', value: 'media' },
];

export default function ArchivePage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedItem, setSelectedItem] = useState<ClipboardItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const query: ClipboardQuery = {
    pageSize: 12,
    status: 'archived',
    ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
  };

  const { items, isLoading, error, hasMore, loadMore, refresh, restoreItem, removeItem } =
    useClipboard(query);

  // Fetch system settings to show retention policy info
  useEffect(() => {
    getSystemSettings()
      .then((settings) => {
        const days = settings?.['retention.deleteAfterArchiveDays'];
        if (typeof days === 'number') {
          setRetentionDays(days);
        }
      })
      .catch(() => {
        // If we can't fetch settings, show "kept indefinitely"
      });
  }, []);

  const showSnackbar = useCallback(
    (message: string, severity: 'success' | 'error') => {
      setSnackbar({ open: true, message, severity });
    },
    [],
  );

  const handleRestore = useCallback(
    async (id: string) => {
      try {
        await restoreItem(id);
        showSnackbar('Item restored to clipboard.', 'success');
      } catch {
        showSnackbar('Failed to restore item.', 'error');
      }
    },
    [restoreItem, showSnackbar],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await removeItem(id);
        showSnackbar('Item permanently deleted.', 'success');
      } catch {
        showSnackbar('Failed to delete item.', 'error');
      }
    },
    [removeItem, showSnackbar],
  );

  const handleItemClick = useCallback((item: ClipboardItem) => {
    setSelectedItem(item);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleSelectItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleRestoreSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await batchOperation(ids, 'restore');
      setSelectedIds(new Set());
      showSnackbar(
        `${ids.length} item${ids.length !== 1 ? 's' : ''} restored.`,
        'success',
      );
      refresh();
    } catch {
      showSnackbar('Failed to restore selected items.', 'error');
    }
  }, [selectedIds, refresh, showSnackbar]);

  const handleDeleteSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await batchOperation(ids, 'delete');
      setSelectedIds(new Set());
      showSnackbar(
        `${ids.length} item${ids.length !== 1 ? 's' : ''} permanently deleted.`,
        'success',
      );
      refresh();
    } catch {
      showSnackbar('Failed to delete selected items.', 'error');
    }
  }, [selectedIds, refresh, showSnackbar]);

  const handleEmptyArchive = useCallback(async () => {
    setEmptyDialogOpen(false);
    const ids = items.map((item) => item.id);
    if (ids.length === 0) return;
    try {
      await batchOperation(ids, 'delete');
      showSnackbar('Archive emptied.', 'success');
      refresh();
    } catch {
      showSnackbar('Failed to empty archive.', 'error');
    }
  }, [items, refresh, showSnackbar]);

  const selectionMode = selectedIds.size > 0;

  const retentionInfo =
    retentionDays != null && retentionDays > 0
      ? `Archived items will be permanently deleted after ${retentionDays} day${retentionDays !== 1 ? 's' : ''}.`
      : 'Archived items are kept indefinitely.';

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      {/* Page header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton onClick={() => navigate('/')} size="small" sx={{ mr: 0.5 }}>
            <ArrowBack />
          </IconButton>
          <Inventory2 sx={{ fontSize: 32, color: 'text.secondary' }} />
          <Box>
            <Typography variant="h5" fontWeight={600}>
              Archive
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {retentionInfo}
            </Typography>
          </Box>
        </Box>

        {items.length > 0 && (
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteSweep />}
            onClick={() => setEmptyDialogOpen(true)}
          >
            Empty Archive
          </Button>
        )}
      </Box>

      {/* Type filter chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
        {TYPE_FILTERS.map(({ label, value }) => (
          <Chip
            key={value}
            label={label}
            clickable
            color={typeFilter === value ? 'primary' : 'default'}
            variant={typeFilter === value ? 'filled' : 'outlined'}
            onClick={() => setTypeFilter(value)}
          />
        ))}
      </Stack>

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load archived items: {error.message}
        </Alert>
      )}

      {/* Item grid */}
      <ClipboardItemList
        items={items}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onItemClick={handleItemClick}
        mode="archive"
        selectedIds={selectedIds}
        onSelectItem={handleSelectItem}
        selectionMode={selectionMode}
        emptyMessage="Archive is empty."
      />

      {/* Multi-select floating bar */}
      <SelectionBar
        selectedCount={selectedIds.size}
        onDeselectAll={handleDeselectAll}
        actions={[
          {
            label: 'Restore Selected',
            icon: Unarchive,
            onClick: handleRestoreSelected,
            color: 'primary',
          },
          {
            label: 'Delete Permanently',
            icon: DeleteForever,
            onClick: handleDeleteSelected,
            color: 'error',
          },
        ]}
      />

      {/* Text item full-view dialog */}
      {selectedItem?.type === 'text' && (
        <TextItemView
          item={selectedItem}
          open={true}
          onClose={handleCloseDialog}
        />
      )}

      {/* File/image/media item detail dialog */}
      {selectedItem && selectedItem.type !== 'text' && (
        <FileItemView
          item={selectedItem}
          open={true}
          onClose={handleCloseDialog}
        />
      )}

      {/* Empty archive confirmation dialog */}
      <Dialog open={emptyDialogOpen} onClose={() => setEmptyDialogOpen(false)}>
        <DialogTitle>Empty Archive</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete all {items.length} item{items.length !== 1 ? 's' : ''} in
            the archive. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmptyDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEmptyArchive} color="error" variant="contained">
            Delete All
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
