import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { ClipboardItem, ClipboardQuery } from '../types';
import { useClipboard } from '../hooks/useClipboard';
import { useClipboardPaste } from '../hooks/useClipboardPaste';
import { useMultipartUpload } from '../hooks/useMultipartUpload';
import { ClipboardInput } from '../components/clipboard/ClipboardInput';
import { ClipboardItemList } from '../components/clipboard/ClipboardItemList';
import { UploadProgress } from '../components/clipboard/UploadProgress';
import { TextItemView } from '../components/clipboard/TextItemView';
import { FileItemView } from '../components/clipboard/FileItemView';

type TypeFilter = 'all' | 'text' | 'image' | 'file' | 'media';

const TYPE_FILTERS: { label: string; value: TypeFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Text', value: 'text' },
  { label: 'Images', value: 'image' },
  { label: 'Files', value: 'file' },
  { label: 'Media', value: 'media' },
];

export default function ClipboardPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedItem, setSelectedItem] = useState<ClipboardItem | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const query: ClipboardQuery = {
    pageSize: 12,
    status: 'active',
    ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
  };

  const { items, isLoading, error, hasMore, loadMore, removeItem, addItem, updateItem } =
    useClipboard(query);

  const {
    startUpload,
    abort: abortMultipart,
    isUploading: isMultipartUploading,
    progress: multipartProgress,
    currentFile: multipartFile,
    isLargeFile,
  } = useMultipartUpload();

  const handleItemCreated = useCallback(
    (item: ClipboardItem) => {
      addItem(item);
      setSnackbar({ open: true, message: 'Item added to clipboard!', severity: 'success' });
    },
    [addItem],
  );

  // Intercept large files: return true to signal ClipboardInput to skip its own upload
  const handleFileSelected = useCallback(
    (file: File): boolean => {
      if (!isLargeFile(file)) return false;

      startUpload(file)
        .then((item) => handleItemCreated(item))
        .catch((err: Error) => {
          if (err.message !== 'Upload cancelled') {
            setSnackbar({
              open: true,
              message: `Upload failed: ${err.message}`,
              severity: 'error',
            });
          }
        });

      return true;
    },
    [isLargeFile, startUpload, handleItemCreated],
  );

  useClipboardPaste(handleItemCreated);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await removeItem(id);
        setSnackbar({ open: true, message: 'Item deleted.', severity: 'success' });
      } catch {
        setSnackbar({ open: true, message: 'Failed to delete item.', severity: 'error' });
      }
    },
    [removeItem],
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

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      {/* Page header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          My Clipboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Paste text or drop files anywhere on this page to save them.
        </Typography>
      </Box>

      {/* Drop/paste input zone */}
      <ClipboardInput
        onItemCreated={handleItemCreated}
        onFileSelected={handleFileSelected}
      />

      {/* Large file multipart upload progress */}
      {isMultipartUploading && multipartFile && (
        <UploadProgress
          fileName={multipartFile.name}
          fileSize={multipartFile.size}
          progress={multipartProgress}
          onCancel={abortMultipart}
        />
      )}

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
          Failed to load clipboard items: {error.message}
        </Alert>
      )}

      {/* Item grid */}
      <ClipboardItemList
        items={items}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onDelete={handleDelete}
        onItemClick={handleItemClick}
        onItemUpdated={updateItem}
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
