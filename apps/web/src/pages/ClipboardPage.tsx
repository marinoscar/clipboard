import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Archive from '@mui/icons-material/Archive';
import { ClipboardItem, ClipboardQuery } from '../types';
import { useClipboard } from '../hooks/useClipboard';
import { useClipboardPaste } from '../hooks/useClipboardPaste';
import { useMultipartUpload } from '../hooks/useMultipartUpload';
import { useFileUpload } from '../hooks/useFileUpload';
import { usePageDrop } from '../hooks/usePageDrop';
import { batchOperation } from '../services/api';
import { ClipboardActionBar } from '../components/clipboard/ClipboardActionBar';
import { ClipboardItemList } from '../components/clipboard/ClipboardItemList';
import { UploadProgressDialog } from '../components/clipboard/UploadProgressDialog';
import { DropOverlay } from '../components/clipboard/DropOverlay';
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

export default function ClipboardPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedItem, setSelectedItem] = useState<ClipboardItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [smallUpload, setSmallUpload] = useState<{ fileName: string; fileSize: number } | null>(null);
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

  const { items, isLoading, error, hasMore, loadMore, refresh, archiveItem, addItem, updateItem } =
    useClipboard(query);

  const {
    startUpload,
    abort: abortMultipart,
    isUploading: isMultipartUploading,
    progress: multipartProgress,
    currentFile: multipartFile,
    isLargeFile,
  } = useMultipartUpload();

  const { upload } = useFileUpload();

  const handleItemCreated = useCallback(
    (item: ClipboardItem) => {
      addItem(item);
      setSnackbar({ open: true, message: 'Item added to clipboard!', severity: 'success' });
    },
    [addItem],
  );

  // Unified file upload handler — routes to multipart or simple upload
  const handleFileForUpload = useCallback(
    async (file: File) => {
      if (isLargeFile(file)) {
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
      } else {
        setSmallUpload({ fileName: file.name, fileSize: file.size });
        try {
          const result = await upload(file);
          if (result) handleItemCreated(result);
        } catch {
          setSnackbar({ open: true, message: 'Upload failed.', severity: 'error' });
        } finally {
          setSmallUpload(null);
        }
      }
    },
    [isLargeFile, startUpload, upload, handleItemCreated],
  );

  // Page-level drag-and-drop
  const handleFilesDropped = useCallback(
    (files: File[]) => {
      for (const file of files) {
        handleFileForUpload(file);
      }
    },
    [handleFileForUpload],
  );

  const { isDragOver } = usePageDrop({ onFilesDropped: handleFilesDropped });

  useClipboardPaste(handleItemCreated);

  const handleArchive = useCallback(
    async (id: string) => {
      try {
        await archiveItem(id);
        setSnackbar({ open: true, message: 'Item archived.', severity: 'success' });
      } catch {
        setSnackbar({ open: true, message: 'Failed to archive item.', severity: 'error' });
      }
    },
    [archiveItem],
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

  const handleArchiveSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await batchOperation(ids, 'archive');
      setSelectedIds(new Set());
      setSnackbar({
        open: true,
        message: `${ids.length} item${ids.length !== 1 ? 's' : ''} archived.`,
        severity: 'success',
      });
      refresh();
    } catch {
      setSnackbar({ open: true, message: 'Failed to archive selected items.', severity: 'error' });
    }
  }, [selectedIds, refresh]);

  const selectionMode = selectedIds.size > 0;

  // Upload dialog state
  const isAnyUpload = isMultipartUploading || smallUpload !== null;
  const uploadFileName = multipartFile?.name || smallUpload?.fileName || '';
  const uploadFileSize = multipartFile?.size || smallUpload?.fileSize || 0;
  const uploadProgress = isMultipartUploading ? multipartProgress : -1;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      {/* Floating action bar */}
      <ClipboardActionBar
        onFileSelected={handleFileForUpload}
        onItemCreated={handleItemCreated}
      />

      {/* Spacer for the fixed action bar */}
      <Box sx={{ height: 56 }} />

      {/* Page header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          My Clipboard
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: { xs: 'none', sm: 'block' } }}
        >
          Paste text or drop files anywhere on this page.
        </Typography>
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
          Failed to load clipboard items: {error.message}
        </Alert>
      )}

      {/* Item grid */}
      <ClipboardItemList
        items={items}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onDelete={handleArchive}
        onItemClick={handleItemClick}
        onItemUpdated={updateItem}
        mode="clipboard"
        selectedIds={selectedIds}
        onSelectItem={handleSelectItem}
        selectionMode={selectionMode}
      />

      {/* Multi-select floating bar */}
      <SelectionBar
        selectedCount={selectedIds.size}
        onDeselectAll={handleDeselectAll}
        actions={[
          {
            label: 'Archive Selected',
            icon: Archive,
            onClick: handleArchiveSelected,
            color: 'primary',
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

      {/* Upload progress dialog */}
      <UploadProgressDialog
        open={isAnyUpload}
        fileName={uploadFileName}
        fileSize={uploadFileSize}
        progress={uploadProgress}
        onCancel={isMultipartUploading ? abortMultipart : () => {}}
      />

      {/* Drag-and-drop overlay */}
      <DropOverlay visible={isDragOver} />

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
