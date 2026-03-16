import { useCallback } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ShareIcon from '@mui/icons-material/Share';
import { ClipboardItem } from '../../types';
import { useWebShare } from '../../hooks/useWebShare';

interface ShareFromAppButtonProps {
  item: ClipboardItem;
}

export function ShareFromAppButton({ item }: ShareFromAppButtonProps) {
  const { isSupported, share } = useWebShare();

  const handleShare = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        if (item.isPublic && item.shareToken) {
          // Share the public URL
          const shareUrl = `${window.location.origin}/share/${item.shareToken}`;
          await share({ title: 'Clipboard Item', url: shareUrl });
        } else if (item.type === 'text' && item.content) {
          // Share the text content
          await share({ title: 'Clipboard Item', text: item.content });
        } else if (item.fileName) {
          // Share the file name as text (can't share actual files without downloading first)
          await share({ title: item.fileName, text: `File: ${item.fileName}` });
        }
      } catch {
        // User cancelled or share failed — ignore
      }
    },
    [item, share],
  );

  if (!isSupported) return null;

  return (
    <Tooltip title="Share via...">
      <IconButton size="small" onClick={handleShare}>
        <ShareIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
