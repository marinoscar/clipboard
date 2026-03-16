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

  // Handle a real paste event (from hidden textarea or Ctrl+V)
  const processPasteEvent = useCallback(
    async (e: globalThis.ClipboardEvent) => {
      const clipData = e.clipboardData;
      if (!clipData) return false;

      // Check for files first (images, PDFs, etc.)
      const files = Array.from(clipData.files);
      if (files.length > 0) {
        for (const file of files) {
          onFileSelected(file);
        }
        return true;
      }

      // Check for image items (e.g., screenshots)
      for (const item of Array.from(clipData.items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            onFileSelected(file);
            return true;
          }
        }
      }

      // Fall back to text
      const text = clipData.getData('text/plain');
      if (text) {
        const created = await createTextItem(text);
        onItemCreated(created);
        return true;
      }

      return false;
    },
    [onFileSelected, onItemCreated],
  );

  const handlePaste = useCallback(async () => {
    // Strategy 1: Use a hidden textarea to capture a real paste event.
    // This gives us access to clipboardData.files which the Clipboard API doesn't support.
    const textarea = document.createElement('textarea');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();

    let handled = false;

    const pasteHandler = async (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        handled = await processPasteEvent(e as globalThis.ClipboardEvent);
      } catch {
        handled = false;
      }
    };

    textarea.addEventListener('paste', pasteHandler, { once: true });

    // Try execCommand('paste') — works on some browsers when triggered by user gesture
    const execResult = document.execCommand('paste');

    if (!execResult || !handled) {
      // Strategy 2: Fall back to Clipboard API for text/images
      textarea.removeEventListener('paste', pasteHandler);

      try {
        if (navigator.clipboard?.read) {
          const clipboardItems = await navigator.clipboard.read();
          for (const clipItem of clipboardItems) {
            // Try any non-text blob type
            for (const type of clipItem.types) {
              if (type === 'text/plain') continue;
              const blob = await clipItem.getType(type);
              const ext = type.split('/')[1]?.split(';')[0] || 'bin';
              const fileName = type.startsWith('image/') ? `clipboard-image.${ext}` : `clipboard-file.${ext}`;
              const file = new File([blob], fileName, { type });
              onFileSelected(file);
              document.body.removeChild(textarea);
              return;
            }
          }
        }

        // Try reading text
        if (navigator.clipboard?.readText) {
          const text = await navigator.clipboard.readText();
          if (text) {
            const item = await createTextItem(text);
            onItemCreated(item);
            document.body.removeChild(textarea);
            return;
          }
        }

        setError('No content found in clipboard. Try copying something first, or use Ctrl+V for files.');
      } catch (err) {
        if (err instanceof Error && err.name === 'NotAllowedError') {
          setError('Clipboard permission denied. Try using Ctrl+V instead.');
        } else {
          setError('Could not read clipboard. Try using Ctrl+V instead.');
        }
      }
    }

    document.body.removeChild(textarea);
  }, [processPasteEvent, onFileSelected, onItemCreated]);

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
