import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import CloudUpload from '@mui/icons-material/CloudUpload';
import ContentPaste from '@mui/icons-material/ContentPaste';
import CameraAlt from '@mui/icons-material/CameraAlt';
import { ClipboardItem } from '../../types';
import { useFileUpload } from '../../hooks/useFileUpload';

interface ClipboardInputProps {
  onItemCreated: (item: ClipboardItem) => void;
  /** Called with the raw File before upload begins; parent can intercept for large files. */
  onFileSelected?: (file: File) => boolean;
}

export function ClipboardInput({ onItemCreated, onFileSelected }: ClipboardInputProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { upload, isUploading, error } = useFileUpload();

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear drag state when leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    for (const file of files) {
      // If parent intercepts the file (returns true), skip the default upload
      if (onFileSelected?.(file)) continue;
      const result = await upload(file);
      if (result) {
        onItemCreated(result);
      }
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      // If parent intercepts the file (returns true), skip the default upload
      if (onFileSelected?.(file)) continue;
      const result = await upload(file);
      if (result) {
        onItemCreated(result);
      }
    }
    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Paper
        variant="outlined"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        sx={{
          position: 'relative',
          minHeight: 150,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          p: 3,
          border: '2px dashed',
          borderColor: isDragOver ? 'primary.main' : 'divider',
          backgroundColor: isDragOver ? 'action.hover' : 'background.paper',
          borderRadius: 2,
          cursor: 'default',
          transition: 'border-color 0.2s, background-color 0.2s',
        }}
      >
        {isUploading ? (
          <>
            <CircularProgress size={40} />
            <Typography color="text.secondary" variant="body2">
              Uploading...
            </Typography>
          </>
        ) : (
          <>
            {isDragOver ? (
              <CloudUpload sx={{ fontSize: 48, color: 'primary.main' }} />
            ) : (
              <ContentPaste sx={{ fontSize: 48, color: 'text.disabled' }} />
            )}
            <Typography
              variant="body1"
              color={isDragOver ? 'primary.main' : 'text.secondary'}
              textAlign="center"
            >
              {isDragOver
                ? 'Drop files here'
                : 'Paste anything (Ctrl+V) or drop files here'}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<CloudUpload />}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                sx={{ minHeight: 44 }}
              >
                Choose Files
              </Button>
              <Button
                variant="outlined"
                startIcon={<CameraAlt />}
                onClick={() => cameraInputRef.current?.click()}
                disabled={isUploading}
                sx={{ minHeight: 44, display: { xs: 'inline-flex', md: 'none' } }}
              >
                Camera
              </Button>
            </Stack>
          </>
        )}

        {/* Drag overlay for better UX */}
        {isDragOver && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              pointerEvents: 'none',
            }}
          />
        )}
      </Paper>

      {error && (
        <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
          Upload failed: {error.message}
        </Typography>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </Box>
  );
}
