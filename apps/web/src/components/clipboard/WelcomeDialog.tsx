import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { HelpContent } from './HelpContent';

const STORAGE_KEY = 'clipboard_hide_welcome';

interface WelcomeDialogProps {
  open: boolean;
  onClose: () => void;
}

export function WelcomeDialog({ open, onClose }: WelcomeDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
        <Box
          component="img"
          src="/icons/icon-192.png"
          alt="Clipboard"
          sx={{ width: 56, height: 56, borderRadius: 2, mb: 1 }}
        />
        <Typography variant="h5" fontWeight={700}>
          Welcome to Clipboard
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Your universal clipboard across all devices
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ px: 3 }}>
        <HelpContent />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, flexDirection: 'column', gap: 1, alignItems: 'stretch' }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2">Don't show this again</Typography>}
          sx={{ mx: 0 }}
        />
        <Button variant="contained" size="large" onClick={handleClose} fullWidth>
          Got it!
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function shouldShowWelcome(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== 'true';
}

export function resetWelcome(): void {
  localStorage.removeItem(STORAGE_KEY);
}
