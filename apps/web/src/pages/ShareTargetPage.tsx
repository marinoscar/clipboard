import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';
import { useAuth } from '../contexts/AuthContext';
import { createTextItem, uploadFile } from '../services/api';
import { getPendingShare, deletePendingShare, cleanupStaleShares } from '../services/shareStorage';

type Status = 'loading' | 'needs-login' | 'processing' | 'success' | 'error' | 'no-data';

export default function ShareTargetPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const processedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to resolve
    if (processedRef.current) return; // Prevent double processing in StrictMode

    const process = async () => {
      await cleanupStaleShares();

      const pending = await getPendingShare();

      if (!pending) {
        setStatus('no-data');
        setTimeout(() => navigate('/', { replace: true }), 1500);
        return;
      }

      if (!user) {
        setStatus('needs-login');
        navigate('/login', {
          state: { from: { pathname: '/share-target', search: '' } },
          replace: true,
        });
        return;
      }

      // Authenticated with pending data — process it
      processedRef.current = true;
      setStatus('processing');

      try {
        if (pending.file) {
          await uploadFile(pending.file);
        } else if (pending.text) {
          await createTextItem(pending.text);
        } else {
          throw new Error('No content in shared data');
        }

        await deletePendingShare(pending.id);
        setStatus('success');
        setTimeout(() => navigate('/', { replace: true }), 1500);
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to save shared content');
      }
    };

    process();
  }, [authLoading, user, navigate]);

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 2,
        }}
      >
        {(status === 'loading' || status === 'processing' || status === 'needs-login') && (
          <>
            <CircularProgress />
            <Typography color="text.secondary">
              {status === 'needs-login' ? 'Redirecting to login...' : 'Saving shared content...'}
            </Typography>
          </>
        )}
        {status === 'success' && (
          <Alert severity="success" sx={{ width: '100%' }}>
            Content saved to clipboard! Redirecting...
          </Alert>
        )}
        {status === 'no-data' && (
          <Alert severity="info" sx={{ width: '100%' }}>
            No shared content found. Redirecting...
          </Alert>
        )}
        {status === 'error' && (
          <Alert severity="error" sx={{ width: '100%' }}>
            {errorMessage}
          </Alert>
        )}
      </Box>
    </Container>
  );
}
