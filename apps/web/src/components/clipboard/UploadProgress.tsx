import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import CloseIcon from '@mui/icons-material/Close';

interface UploadProgressProps {
  fileName: string;
  fileSize: number;
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

export function UploadProgress({
  fileName,
  fileSize,
  progress,
  onCancel,
}: UploadProgressProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 3,
        borderRadius: 2,
        borderColor: 'primary.main',
        backgroundColor: 'action.hover',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1,
        }}
      >
        <Box sx={{ overflow: 'hidden', flex: 1, mr: 1 }}>
          <Typography
            variant="body2"
            fontWeight={500}
            noWrap
            title={fileName}
          >
            {fileName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatFileSize(fileSize)} — {progress}%
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={onCancel}
          aria-label="Cancel upload"
          sx={{ flexShrink: 0 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ borderRadius: 1, height: 6 }}
        aria-label={`Uploading ${fileName}: ${progress}%`}
      />
    </Paper>
  );
}
