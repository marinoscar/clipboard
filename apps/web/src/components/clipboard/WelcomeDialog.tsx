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
import ContentPaste from '@mui/icons-material/ContentPaste';
import CloudUpload from '@mui/icons-material/CloudUpload';
import CameraAlt from '@mui/icons-material/CameraAlt';
import Inventory2 from '@mui/icons-material/Inventory2';
import Share from '@mui/icons-material/Share';
import DevicesOther from '@mui/icons-material/DevicesOther';

const STORAGE_KEY = 'clipboard_hide_welcome';

interface WelcomeDialogProps {
  open: boolean;
  onClose: () => void;
}

interface FeatureRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureRow({ icon, title, description }: FeatureRowProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
      <Box
        sx={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="subtitle2" fontWeight={600}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
    </Box>
  );
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

      <DialogContent sx={{ px: 3 }}>
        <FeatureRow
          icon={<ContentPaste fontSize="small" />}
          title="Paste Anything"
          description="Tap the green Paste button or press Ctrl+V to save text from your clipboard instantly."
        />
        <FeatureRow
          icon={<CloudUpload fontSize="small" />}
          title="Upload Files"
          description="Tap Upload to pick files, or drag and drop them anywhere on the page (desktop)."
        />
        <FeatureRow
          icon={<CameraAlt fontSize="small" />}
          title="Camera Capture"
          description="On mobile, tap the Camera button to snap a photo and save it directly."
        />
        <FeatureRow
          icon={<Share fontSize="small" />}
          title="Share Items"
          description="Tap the link icon on any item to generate a public share URL."
        />
        <FeatureRow
          icon={<Inventory2 fontSize="small" />}
          title="Archive & Organize"
          description="Archive items you don't need right now. Restore or permanently delete them later."
        />
        <FeatureRow
          icon={<DevicesOther fontSize="small" />}
          title="Sync Across Devices"
          description="Items appear in real-time on all your logged-in devices. Install as an app for the best experience."
        />
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
