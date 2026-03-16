import { useState, useEffect, useRef } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import ContentCopy from '@mui/icons-material/ContentCopy';
import { ClipboardItem } from '../../types';
import { enableSharing, disableSharing } from '../../services/api';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  item: ClipboardItem;
  onItemUpdated: (item: ClipboardItem) => void;
}

function buildShareUrl(shareToken: string): string {
  return `${window.location.origin}/share/${shareToken}`;
}

export function ShareDialog({ open, onClose, item, onItemUpdated }: ShareDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const autoEnabledRef = useRef(false);

  const shareUrl = item.isPublic && item.shareToken ? buildShareUrl(item.shareToken) : null;

  // Auto-enable sharing when dialog opens and item is not yet public
  useEffect(() => {
    if (!open) {
      autoEnabledRef.current = false;
      return;
    }
    if (item.isPublic || autoEnabledRef.current || isLoading) return;

    autoEnabledRef.current = true;
    setIsLoading(true);
    setError(null);

    enableSharing(item.id)
      .then((result) => {
        const updated = { ...item, isPublic: true, shareToken: result.shareToken };
        onItemUpdated(updated);

        // Auto-copy the URL to clipboard
        const url = buildShareUrl(result.shareToken);
        navigator.clipboard.writeText(url).then(() => {
          setSnackbarOpen(true);
        }).catch(() => {
          // clipboard write failed silently
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to enable sharing');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [open, item, isLoading, onItemUpdated]);

  const handleToggle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (item.isPublic) {
        await disableSharing(item.id);
        onItemUpdated({ ...item, isPublic: false, shareToken: null });
      } else {
        const result = await enableSharing(item.id);
        const updated = { ...item, isPublic: true, shareToken: result.shareToken };
        onItemUpdated(updated);

        // Auto-copy URL on re-enable
        const url = buildShareUrl(result.shareToken);
        try {
          await navigator.clipboard.writeText(url);
          setSnackbarOpen(true);
        } catch {
          // clipboard write failed silently
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sharing settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setSnackbarOpen(true);
    } catch {
      // fallback: select the text field
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  // Stop propagation on the dialog to prevent the card click handler from firing
  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        onClick={stopPropagation}
        onMouseDown={stopPropagation}
      >
        <DialogTitle>Share Item</DialogTitle>

        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={item.isPublic}
                  onChange={handleToggle}
                  disabled={isLoading}
                  color="primary"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1">
                    {item.isPublic ? 'Public — anyone with the link can view' : 'Private — only you can view'}
                  </Typography>
                  {isLoading && <CircularProgress size={16} />}
                </Box>
              }
            />

            {item.isPublic && shareUrl && (
              <TextField
                label="Share URL"
                value={shareUrl}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={handleCopy}
                        edge="end"
                        aria-label="Copy share URL"
                        size="small"
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                fullWidth
                size="small"
                onFocus={(e) => e.target.select()}
              />
            )}

            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" sx={{ width: '100%' }}>
          Link copied to clipboard!
        </Alert>
      </Snackbar>
    </>
  );
}
