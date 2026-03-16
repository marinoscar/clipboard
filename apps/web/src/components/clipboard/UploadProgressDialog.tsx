import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

interface UploadProgressDialogProps {
  open: boolean;
  fileName: string;
  fileSize: number;
  /** 0-100 for determinate progress, -1 for indeterminate (small file upload) */
  progress: number;
  onCancel: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function UploadProgressDialog({
  open,
  fileName,
  fileSize,
  progress,
  onCancel,
}: UploadProgressDialogProps) {
  const isIndeterminate = progress < 0;

  return (
    <Dialog open={open} maxWidth="xs" fullWidth disableEscapeKeyDown>
      <DialogTitle>Uploading...</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={500} noWrap title={fileName}>
            {fileName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatFileSize(fileSize)}
            {!isIndeterminate && ` — ${Math.round(progress)}%`}
          </Typography>
        </Box>
        <LinearProgress
          variant={isIndeterminate ? 'indeterminate' : 'determinate'}
          value={isIndeterminate ? undefined : progress}
          sx={{ borderRadius: 1, height: 6 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="error" disabled={isIndeterminate}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
