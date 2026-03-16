import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { HelpContent } from '../components/clipboard/HelpContent';

export default function HelpPage() {
  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Box
          component="img"
          src="/icons/icon-192.png"
          alt="Clipboard"
          sx={{ width: 64, height: 64, borderRadius: 2, mb: 1 }}
        />
        <Typography variant="h4" fontWeight={700}>
          Clipboard
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          Your universal clipboard across all devices
        </Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <HelpContent />
      </Paper>
    </Box>
  );
}
