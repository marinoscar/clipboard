import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Download from '@mui/icons-material/Download';
import InsertDriveFile from '@mui/icons-material/InsertDriveFile';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { VideoPlayer } from '../components/clipboard/VideoPlayer';
import { getPublicItem, getPublicDownloadUrl } from '../services/api';
import type { ClipboardItem } from '../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function TextContent({ item }: { item: ClipboardItem }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!item.content) return;
    await navigator.clipboard.writeText(item.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
          <IconButton onClick={handleCopy} color={copied ? 'success' : 'default'} aria-label="Copy text">
            <ContentCopy />
          </IconButton>
        </Tooltip>
      </Box>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          backgroundColor: 'action.hover',
          maxHeight: '60vh',
          overflowY: 'auto',
        }}
      >
        {item.content}
      </Paper>
    </Box>
  );
}

function FileContent({ item, shareToken }: { item: ClipboardItem; shareToken: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { url } = await getPublicDownloadUrl(shareToken);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // silently fail
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 2 }}>
      <InsertDriveFile sx={{ fontSize: 64, color: 'text.disabled' }} />
      <Typography variant="h6">{item.fileName || 'File'}</Typography>
      {item.fileSize != null && (
        <Typography variant="body2" color="text.secondary">
          {formatFileSize(item.fileSize)}
          {item.mimeType ? ` · ${item.mimeType}` : ''}
        </Typography>
      )}
      <Button
        variant="contained"
        startIcon={<Download />}
        onClick={handleDownload}
        disabled={isDownloading}
      >
        Download
      </Button>
    </Box>
  );
}

function ImageContent({ item, shareToken }: { item: ClipboardItem; shareToken: string }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    getPublicDownloadUrl(shareToken)
      .then(({ url }) => setDownloadUrl(url))
      .catch(() => {});
  }, [shareToken]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { url } = await getPublicDownloadUrl(shareToken);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // silently fail
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {downloadUrl && (
        <Box
          component="img"
          src={downloadUrl}
          alt={item.fileName || 'Image'}
          sx={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 1, objectFit: 'contain' }}
        />
      )}
      <Typography variant="body2" color="text.secondary">
        {item.fileName || 'Image'}
        {item.fileSize != null ? ` · ${formatFileSize(item.fileSize)}` : ''}
      </Typography>
      <Button
        variant="outlined"
        startIcon={<Download />}
        onClick={handleDownload}
        disabled={isDownloading}
      >
        Download
      </Button>
    </Box>
  );
}

function VideoContent({ item, shareToken }: { item: ClipboardItem; shareToken: string }) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    getPublicDownloadUrl(shareToken)
      .then(({ url }) => setDownloadUrl(url))
      .catch(() => {});
  }, [shareToken]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { url } = await getPublicDownloadUrl(shareToken);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // silently fail
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {downloadUrl ? (
        <VideoPlayer src={downloadUrl} title={item.fileName || undefined} />
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {item.fileName || 'Video'}
          {item.fileSize != null ? ` · ${formatFileSize(item.fileSize)}` : ''}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Download />}
          onClick={handleDownload}
          disabled={isDownloading}
        >
          Download
        </Button>
      </Box>
    </Box>
  );
}

export default function PublicItemPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [item, setItem] = useState<ClipboardItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!shareToken) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    getPublicItem(shareToken)
      .then((data) => {
        setItem(data);
      })
      .catch(() => {
        setNotFound(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [shareToken]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Minimal header */}
      <Box
        component="header"
        sx={{
          py: 2,
          px: 3,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="h6" fontWeight={700} color="primary">
          Clipboard
        </Typography>
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', py: 4 }}>
        <Container maxWidth="md">
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <LoadingSpinner />
            </Box>
          )}

          {!isLoading && notFound && (
            <Paper
              variant="outlined"
              sx={{ p: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
            >
              <Typography variant="h5" gutterBottom>
                Item not found
              </Typography>
              <Typography variant="body1" color="text.secondary">
                This item may have expired, been deleted, or the link is invalid.
              </Typography>
              <Alert severity="info" sx={{ mt: 1 }}>
                Shared items may be subject to retention policies. If you expected to find something here, please contact the person who shared it with you.
              </Alert>
            </Paper>
          )}

          {!isLoading && item && (
            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="overline" color="text.secondary">
                  Shared item · {item.type}
                </Typography>
                <Typography variant="h6" gutterBottom>
                  {item.fileName || (item.type === 'text' ? 'Text snippet' : 'Clipboard item')}
                </Typography>
                <Divider />
              </Box>

              {item.type === 'text' && <TextContent item={item} />}
              {item.type === 'image' && shareToken && (
                <ImageContent item={item} shareToken={shareToken} />
              )}
              {item.type === 'media' && item.mimeType?.startsWith('video/') && shareToken && (
                <VideoContent item={item} shareToken={shareToken} />
              )}
              {((item.type === 'file') || (item.type === 'media' && !item.mimeType?.startsWith('video/'))) && shareToken && (
                <FileContent item={item} shareToken={shareToken} />
              )}
            </Paper>
          )}
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 2,
          textAlign: 'center',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Powered by Clipboard
        </Typography>
      </Box>
    </Box>
  );
}
