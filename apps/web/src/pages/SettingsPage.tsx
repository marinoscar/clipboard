import { useEffect, useState, useCallback } from 'react';
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
import { PersonalAccessTokens } from '../components/settings/PersonalAccessTokens';
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
          typeof settings['retention.archiveAfterDays'] === 'number' ? settings['retention.archiveAfterDays'] as number : null,
        deleteAfterArchiveDays:
          typeof settings['retention.deleteAfterArchiveDays'] === 'number'
            ? settings['retention.deleteAfterArchiveDays'] as number
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
        'retention.archiveAfterDays': retention.archiveAfterDays,
        'retention.deleteAfterArchiveDays': retention.deleteAfterArchiveDays,
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

  if (authLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your account settings and access tokens.
        </Typography>
      </Box>

      {/* Personal Access Tokens — visible to all users */}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Personal Access Tokens
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <PersonalAccessTokens />
      </Paper>

      {/* Admin-only: Content Retention */}
      {user?.isAdmin && (
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
      )}

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
