import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';
import { createTextItem, uploadFile } from '../services/api';

export default function ShareTargetPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleSharedContent = async (data: { text?: string | null; file?: File | null }) => {
      try {
        if (data.file) {
          await uploadFile(data.file);
        } else if (data.text) {
          await createTextItem(data.text);
        } else {
          throw new Error('No content received');
        }
        setStatus('success');
        // Redirect to home after short delay
        setTimeout(() => navigate('/', { replace: true }), 1500);
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to save shared content');
      }
    };

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'share-target') {
        handleSharedContent(event.data);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handler);

    // Also check URL params for the shared=true flag (fallback if no SW message arrives)
    const params = new URLSearchParams(window.location.search);
    if (params.get('shared') === 'true') {
      // Wait a bit for the SW message; if none arrives, redirect home
      const timeout = setTimeout(() => {
        if (status === 'processing') {
          navigate('/', { replace: true });
        }
      }, 3000);
      return () => {
        clearTimeout(timeout);
        navigator.serviceWorker?.removeEventListener('message', handler);
      };
    }

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handler);
    };
  }, [navigate, status]);

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
        {status === 'processing' && (
          <>
            <CircularProgress />
            <Typography color="text.secondary">Saving shared content...</Typography>
          </>
        )}
        {status === 'success' && (
          <Alert severity="success" sx={{ width: '100%' }}>
            Content saved to clipboard! Redirecting...
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
