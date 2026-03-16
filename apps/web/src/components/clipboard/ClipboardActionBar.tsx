import { useRef, useCallback, useState, ChangeEvent } from 'react';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
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

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        onFileSelected(file);
      }
      // Reset so the same file can be re-selected
      if (e.target) e.target.value = '';
    },
    [onFileSelected],
  );

  const handlePaste = useCallback(async () => {
    try {
      if (!navigator.clipboard?.readText) {
        setError('Clipboard API not available. Use Ctrl+V to paste.');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text) {
        setError('Clipboard is empty.');
        return;
      }
      const item = await createTextItem(text);
      onItemCreated(item);
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Clipboard permission denied. Use Ctrl+V to paste.');
      } else {
        setError('Failed to paste from clipboard.');
      }
    }
  }, [onItemCreated]);

  return (
    <>
      <Paper
        elevation={3}
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
        }}
      >
        <Stack direction="row" spacing={1.5}>
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
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<CameraAlt />}
            onClick={() => cameraInputRef.current?.click()}
            sx={{ display: { xs: 'inline-flex', md: 'none' } }}
          >
            Camera
          </Button>
        </Stack>
      </Paper>

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
