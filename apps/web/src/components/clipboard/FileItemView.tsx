import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Close from '@mui/icons-material/Close';
import Download from '@mui/icons-material/Download';
import InsertDriveFile from '@mui/icons-material/InsertDriveFile';
import { ClipboardItem } from '../../types';
import { getDownloadUrl } from '../../services/api';

interface FileItemViewProps {
  item: ClipboardItem;
  open: boolean;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function FileItemView({ item, open, onClose }: FileItemViewProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const isImage = item.type === 'image' || item.mimeType?.startsWith('image/');

  useEffect(() => {
    if (!open) return;
    setIsLoadingUrl(true);
    setUrlError(null);
    getDownloadUrl(item.id)
      .then(({ url }) => setDownloadUrl(url))
      .catch((err) => setUrlError(err.message || 'Could not load download URL'))
      .finally(() => setIsLoadingUrl(false));
  }, [open, item.id]);

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <InsertDriveFile />
          <Typography
            variant="h6"
            noWrap
            title={item.fileName || undefined}
            sx={{ flex: 1, minWidth: 0 }}
          >
            {item.fileName || 'File'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ ml: 1, flexShrink: 0 }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Metadata */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
              File name
            </Typography>
            <Typography variant="body2">{item.fileName || '—'}</Typography>
          </Box>

          {item.fileSize != null && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
                Size
              </Typography>
              <Typography variant="body2">{formatFileSize(item.fileSize)}</Typography>
            </Box>
          )}

          {item.mimeType && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
                Type
              </Typography>
              <Typography variant="body2">{item.mimeType}</Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
              Uploaded
            </Typography>
            <Typography variant="body2">
              {new Date(item.createdAt).toLocaleString()}
            </Typography>
          </Box>
        </Box>

        {/* Image preview */}
        {isImage && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              {isLoadingUrl ? (
                <CircularProgress />
              ) : urlError ? (
                <Typography color="error" variant="body2">
                  {urlError}
                </Typography>
              ) : downloadUrl ? (
                <Box
                  component="img"
                  src={downloadUrl}
                  alt={item.fileName || 'Image preview'}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 400,
                    objectFit: 'contain',
                    borderRadius: 1,
                  }}
                />
              ) : null}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        {urlError && !isImage && (
          <Typography variant="caption" color="error" sx={{ flex: 1, ml: 1 }}>
            {urlError}
          </Typography>
        )}
        <Button
          onClick={handleDownload}
          startIcon={isLoadingUrl ? <CircularProgress size={16} /> : <Download />}
          variant="contained"
          disabled={isLoadingUrl || !downloadUrl}
        >
          Download
        </Button>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
