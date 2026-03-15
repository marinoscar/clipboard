import { Box, Typography, Paper } from '@mui/material';
import { ContentPaste as ClipboardIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 128px)',
      }}
    >
      <Paper
        sx={{
          p: 4,
          textAlign: 'center',
          maxWidth: 500,
        }}
      >
        <ClipboardIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Welcome, {user?.displayName || user?.email}!
        </Typography>
        <Typography color="text.secondary">
          Your clipboard is ready. In Phase 2, you'll be able to paste text,
          upload files, and sync across all your devices.
        </Typography>
      </Paper>
    </Box>
  );
}
