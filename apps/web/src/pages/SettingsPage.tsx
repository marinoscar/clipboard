import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { RetentionSettings, RetentionValues } from '../components/settings/RetentionSettings';
import { getSystemSettings, updateSystemSettings } from '../services/api';

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const [retention, setRetention] = useState<RetentionValues>({
    archiveAfterDays: null,
    deleteAfterArchiveDays: null,
  });

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const settings = await getSystemSettings();
      setRetention({
        archiveAfterDays:
          typeof settings.archiveAfterDays === 'number' ? settings.archiveAfterDays : null,
        deleteAfterArchiveDays:
          typeof settings.deleteAfterArchiveDays === 'number'
            ? settings.deleteAfterArchiveDays
            : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isAdmin) {
      loadSettings();
    }
  }, [user, loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSystemSettings({
        archiveAfterDays: retention.archiveAfterDays,
        deleteAfterArchiveDays: retention.deleteAfterArchiveDays,
      });
      setSnackbar({ open: true, message: 'Settings saved successfully.', severity: 'success' });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to save settings',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Wait for auth to resolve before deciding on redirect
  if (authLoading) {
    return <LoadingSpinner fullScreen />;
  }

  // Non-admins are redirected to home
  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          System Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure system-wide behaviour. Only administrators can access this page.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" gutterBottom>
          Content Retention
        </Typography>
        <Divider sx={{ mb: 3 }} />

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <LoadingSpinner />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!isLoading && !error && (
          <RetentionSettings
            values={retention}
            onChange={setRetention}
            onSave={handleSave}
            saving={saving}
          />
        )}
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
