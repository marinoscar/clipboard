import { useRef, useCallback, useState, ChangeEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloudUpload from '@mui/icons-material/CloudUpload';
import ContentPaste from '@mui/icons-material/ContentPaste';
import CameraAlt from '@mui/icons-material/CameraAlt';
import { ClipboardItem } from '../../types';
import { createTextItem } from '../../services/api';

interface ClipboardActionBarProps {
  onFileSelected: (file: File) => void;
  onItemCreated: (item: ClipboardItem) => void;
}

export function ClipboardActionBar({ onFileSelected, onItemCreated }: ClipboardActionBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        onFileSelected(file);
      }
      if (e.target) e.target.value = '';
    },
    [onFileSelected],
  );

  const handlePaste = useCallback(async () => {
    if (!navigator.clipboard) {
      setError('Clipboard API not available on this browser.');
      return;
    }

    // Strategy 1: Try clipboard.read() for images/blobs (separate try/catch)
    if (navigator.clipboard.read) {
      try {
        const clipboardItems = await navigator.clipboard.read();
        for (const clipItem of clipboardItems) {
          for (const type of clipItem.types) {
            if (type === 'text/plain' || type === 'text/html') continue;
            const blob = await clipItem.getType(type);
            const ext = type.split('/')[1]?.split(';')[0] || 'bin';
            const fileName = type.startsWith('image/')
              ? `clipboard-image.${ext}`
              : `clipboard-file.${ext}`;
            const file = new File([blob], fileName, { type });
            onFileSelected(file);
            return;
          }
        }
      } catch {
        // clipboard.read() failed (permission denied or unsupported content)
        // Fall through to text strategy
      }
    }

    // Strategy 2: Try readText() for plain text (separate try/catch)
    if (navigator.clipboard.readText) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const item = await createTextItem(text);
          onItemCreated(item);
          return;
        }
      } catch {
        // readText() failed — fall through to error
      }
    }

    // Neither strategy worked
    setError('No content found. For files, use the Upload button or Ctrl+V.');
  }, [onFileSelected, onItemCreated]);

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          top: { xs: 56, sm: 64 },
          left: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.appBar - 1,
          display: 'flex',
          justifyContent: 'center',
          py: 1,
          px: 2,
          pointerEvents: 'none',
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ pointerEvents: 'auto' }}>
          {isMobile ? (
            <>
              <Tooltip title="Paste">
                <IconButton
                  color="success"
                  onClick={handlePaste}
                  sx={{
                    bgcolor: 'success.main',
                    color: 'success.contrastText',
                    '&:hover': { bgcolor: 'success.dark' },
                    width: 48,
                    height: 48,
                  }}
                >
                  <ContentPaste />
                </IconButton>
              </Tooltip>
              <Tooltip title="Upload">
                <IconButton
                  color="primary"
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                    width: 48,
                    height: 48,
                  }}
                >
                  <CloudUpload />
                </IconButton>
              </Tooltip>
              <Tooltip title="Camera">
                <IconButton
                  color="primary"
                  onClick={() => cameraInputRef.current?.click()}
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                    width: 48,
                    height: 48,
                  }}
                >
                  <CameraAlt />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <>
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<ContentPaste />}
                onClick={handlePaste}
              >
                Paste
              </Button>
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<CloudUpload />}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload
              </Button>
            </>
          )}
        </Stack>
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" variant="filled" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}
