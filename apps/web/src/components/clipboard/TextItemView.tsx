import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Close from '@mui/icons-material/Close';
import { ClipboardItem } from '../../types';

interface TextItemViewProps {
  item: ClipboardItem;
  open: boolean;
  onClose: () => void;
}

export function TextItemView({ item, open, onClose }: TextItemViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (item.content) {
      await navigator.clipboard.writeText(item.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>Text Content</span>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
            <IconButton onClick={handleCopy} size="small" color={copied ? 'success' : 'default'}>
              <ContentCopy />
            </IconButton>
          </Tooltip>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Typography
          component="pre"
          variant="body2"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
            m: 0,
            lineHeight: 1.6,
          }}
        >
          {item.content}
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCopy} startIcon={<ContentCopy />} color={copied ? 'success' : 'primary'}>
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
