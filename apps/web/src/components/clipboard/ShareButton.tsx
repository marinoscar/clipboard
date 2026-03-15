import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Share from '@mui/icons-material/Share';
import ShareOutlined from '@mui/icons-material/ShareOutlined';
import { ClipboardItem } from '../../types';
import { ShareDialog } from './ShareDialog';

interface ShareButtonProps {
  item: ClipboardItem;
  onItemUpdated: (item: ClipboardItem) => void;
}

export function ShareButton({ item, onItemUpdated }: ShareButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Tooltip title="Share">
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setDialogOpen(true);
          }}
          color={item.isPublic ? 'primary' : 'default'}
          aria-label="Share item"
        >
          {item.isPublic ? <Share fontSize="small" /> : <ShareOutlined fontSize="small" />}
        </IconButton>
      </Tooltip>

      <ShareDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        item={item}
        onItemUpdated={(updated) => {
          onItemUpdated(updated);
          setDialogOpen(false);
        }}
      />
    </>
  );
}
