import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Delete from '@mui/icons-material/Delete';
import Download from '@mui/icons-material/Download';
import InsertDriveFile from '@mui/icons-material/InsertDriveFile';
import Image from '@mui/icons-material/Image';
import AudioFile from '@mui/icons-material/AudioFile';
import VideoFile from '@mui/icons-material/VideoFile';
import TextSnippet from '@mui/icons-material/TextSnippet';
import LinkIcon from '@mui/icons-material/Link';
import { ClipboardItem } from '../../types';
import { getDownloadUrl } from '../../services/api';
import { ShareButton } from './ShareButton';

interface ClipboardItemCardProps {
  item: ClipboardItem;
  onDelete: (id: string) => void;
  onClick?: (item: ClipboardItem) => void;
  onItemUpdated?: (item: ClipboardItem) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 30) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 172800) return 'yesterday';
  return new Date(dateStr).toLocaleDateString();
}

function typeIcon(type: ClipboardItem['type']) {
  switch (type) {
    case 'image':
      return <Image fontSize="small" />;
    case 'media':
      return <VideoFile fontSize="small" />;
    case 'file':
      return <InsertDriveFile fontSize="small" />;
    default:
      return <TextSnippet fontSize="small" />;
  }
}

function typeColor(
  type: ClipboardItem['type'],
): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'info' {
  switch (type) {
    case 'text':
      return 'default';
    case 'image':
      return 'success';
    case 'media':
      return 'warning';
    case 'file':
      return 'info';
    default:
      return 'default';
  }
}

export function ClipboardItemCard({ item, onDelete, onClick, onItemUpdated }: ClipboardItemCardProps) {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.content) {
      await navigator.clipboard.writeText(item.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      const { url } = await getDownloadUrl(item.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // silently fail — user can retry
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.id);
  };

  const handleCardClick = () => {
    if (onClick) onClick(item);
  };

  return (
    <Card
      variant="outlined"
      onClick={handleCardClick}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
        '&:hover': onClick
          ? { boxShadow: 3 }
          : undefined,
      }}
    >
      <CardContent sx={{ flex: 1, pb: 0 }}>
        {/* Header row: type chip + public indicator + timestamp */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              icon={typeIcon(item.type)}
              label={item.type}
              size="small"
              color={typeColor(item.type)}
              variant="outlined"
            />
            {item.isPublic && (
              <Tooltip title="Shared publicly">
                <Chip
                  icon={<LinkIcon fontSize="small" />}
                  label="Public"
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Tooltip>
            )}
          </Box>
          <Typography variant="caption" color="text.disabled">
            {formatRelativeTime(item.createdAt)}
          </Typography>
        </Box>

        {/* Content preview */}
        {item.type === 'text' && (
          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 6,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: 'text.primary',
            }}
          >
            {item.content?.slice(0, 200)}
            {(item.content?.length ?? 0) > 200 ? '…' : ''}
          </Typography>
        )}

        {item.type === 'image' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Image sx={{ color: 'success.main' }} />
            <Box>
              <Typography variant="body2" noWrap>
                {item.fileName || 'Image'}
              </Typography>
              {item.fileSize != null && (
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(item.fileSize)}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {item.type === 'file' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InsertDriveFile sx={{ color: 'info.main' }} />
            <Box>
              <Typography variant="body2" noWrap>
                {item.fileName || 'File'}
              </Typography>
              {item.fileSize != null && (
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(item.fileSize)}
                  {item.mimeType ? ` · ${item.mimeType}` : ''}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {item.type === 'media' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {item.mimeType?.startsWith('audio/') ? (
              <AudioFile sx={{ color: 'warning.main' }} />
            ) : (
              <VideoFile sx={{ color: 'warning.main' }} />
            )}
            <Box>
              <Typography variant="body2" noWrap>
                {item.fileName || 'Media'}
              </Typography>
              {item.fileSize != null && (
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(item.fileSize)}
                  {item.mimeType ? ` · ${item.mimeType}` : ''}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
        {item.type === 'text' && (
          <Tooltip title={copied ? 'Copied!' : 'Copy'}>
            <IconButton size="small" onClick={handleCopy} color={copied ? 'success' : 'default'}>
              <ContentCopy fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {item.type !== 'text' && (
          <Tooltip title="Download">
            <span>
              <IconButton
                size="small"
                onClick={handleDownload}
                disabled={isDownloading}
              >
                <Download fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {onItemUpdated && (
          <ShareButton item={item} onItemUpdated={onItemUpdated} />
        )}

        <Tooltip title="Delete">
          <IconButton size="small" onClick={handleDelete} color="error">
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
}
