import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UploadProgress } from './UploadProgress';

describe('UploadProgress', () => {
  const defaultProps = {
    fileName: 'document.pdf',
    fileSize: 1048576, // 1 MB
    progress: 42,
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render file name', () => {
    render(<UploadProgress {...defaultProps} />);
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
  });

  it('should render file size', () => {
    render(<UploadProgress {...defaultProps} />);
    // 1 MB = 1.0 MB with the formatter
    expect(screen.getByText(/1\.0 MB/)).toBeInTheDocument();
  });

  it('should show progress percentage', () => {
    render(<UploadProgress {...defaultProps} />);
    // Displayed as "1.0 MB — 42%"
    expect(screen.getByText(/42%/)).toBeInTheDocument();
  });

  it('should render progress bar with correct value attribute', () => {
    render(<UploadProgress {...defaultProps} />);
    // MUI LinearProgress renders a role="progressbar" element
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    // aria-valuenow reflects the determinate value
    expect(progressBar).toHaveAttribute('aria-valuenow', '42');
  });

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<UploadProgress {...defaultProps} onCancel={onCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel upload/i });
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      render(<UploadProgress {...defaultProps} fileSize={512} />);
      expect(screen.getByText(/512 B/)).toBeInTheDocument();
    });

    it('should format kilobytes', () => {
      render(<UploadProgress {...defaultProps} fileSize={2048} />);
      expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    });

    it('should format megabytes', () => {
      render(<UploadProgress {...defaultProps} fileSize={5 * 1024 * 1024} />);
      expect(screen.getByText(/5\.0 MB/)).toBeInTheDocument();
    });

    it('should format gigabytes', () => {
      render(<UploadProgress {...defaultProps} fileSize={2 * 1024 * 1024 * 1024} />);
      expect(screen.getByText(/2\.0 GB/)).toBeInTheDocument();
    });

    it('should format zero bytes', () => {
      render(<UploadProgress {...defaultProps} fileSize={0} />);
      expect(screen.getByText(/0 B/)).toBeInTheDocument();
    });
  });

  it('should use file name as title attribute for truncation support', () => {
    const longName = 'a-very-long-file-name-that-might-be-truncated.pdf';
    render(<UploadProgress {...defaultProps} fileName={longName} />);
    const nameEl = screen.getByText(longName);
    expect(nameEl).toHaveAttribute('title', longName);
  });

  it('should include file name in progress bar aria-label', () => {
    render(<UploadProgress {...defaultProps} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute(
      'aria-label',
      'Uploading document.pdf: 42%',
    );
  });
});
