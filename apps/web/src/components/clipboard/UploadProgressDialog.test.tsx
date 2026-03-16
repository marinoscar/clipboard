import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UploadProgressDialog } from './UploadProgressDialog';

const defaultProps = {
  open: true,
  fileName: 'document.pdf',
  fileSize: 1048576, // 1.0 MB
  progress: 50,
  onCancel: vi.fn(),
};

describe('UploadProgressDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render dialog content when open is false', () => {
    render(<UploadProgressDialog {...defaultProps} open={false} />);

    // MUI Dialog removes content from the DOM when closed by default.
    expect(screen.queryByText('Uploading...')).not.toBeInTheDocument();
  });

  it('renders dialog with "Uploading..." title when open is true', () => {
    render(<UploadProgressDialog {...defaultProps} />);

    expect(screen.getByText('Uploading...')).toBeInTheDocument();
  });

  it('shows the file name', () => {
    render(<UploadProgressDialog {...defaultProps} fileName="report.xlsx" />);

    expect(screen.getByText('report.xlsx')).toBeInTheDocument();
  });

  it('shows a formatted file size for bytes', () => {
    render(<UploadProgressDialog {...defaultProps} fileSize={512} progress={10} />);

    // 512 B
    expect(screen.getByText(/512 B/)).toBeInTheDocument();
  });

  it('shows a formatted file size for kilobytes', () => {
    render(<UploadProgressDialog {...defaultProps} fileSize={2048} progress={10} />);

    // 2048 / 1024 = 2.0 KB
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
  });

  it('shows a formatted file size for megabytes', () => {
    render(<UploadProgressDialog {...defaultProps} fileSize={1048576} progress={10} />);

    // 1048576 / 1024 / 1024 = 1.0 MB
    expect(screen.getByText(/1\.0 MB/)).toBeInTheDocument();
  });

  it('shows a formatted file size for gigabytes', () => {
    render(
      <UploadProgressDialog
        {...defaultProps}
        fileSize={1073741824}
        progress={10}
      />,
    );

    // 1 GB
    expect(screen.getByText(/1\.0 GB/)).toBeInTheDocument();
  });

  it('shows the percentage when progress is zero or greater (determinate mode)', () => {
    render(<UploadProgressDialog {...defaultProps} progress={0} />);

    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it('shows the rounded percentage for a mid-progress value', () => {
    render(<UploadProgressDialog {...defaultProps} progress={73.6} />);

    expect(screen.getByText(/74%/)).toBeInTheDocument();
  });

  it('shows 100% when upload is complete', () => {
    render(<UploadProgressDialog {...defaultProps} progress={100} />);

    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('does not show a percentage when progress is negative (indeterminate mode)', () => {
    render(<UploadProgressDialog {...defaultProps} progress={-1} />);

    // The caption must not contain a "%" character at all.
    const caption = screen.getByText(/1\.0 MB/);
    expect(caption.textContent).not.toMatch(/%/);
  });

  it('renders a LinearProgress bar in determinate mode when progress >= 0', () => {
    render(<UploadProgressDialog {...defaultProps} progress={40} />);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '40');
  });

  it('renders a LinearProgress bar in indeterminate mode when progress < 0', () => {
    render(<UploadProgressDialog {...defaultProps} progress={-1} />);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    // Indeterminate bars have no aria-valuenow.
    expect(progressBar).not.toHaveAttribute('aria-valuenow');
  });

  it('Cancel button is disabled in indeterminate mode (progress < 0)', () => {
    render(<UploadProgressDialog {...defaultProps} progress={-1} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toBeDisabled();
  });

  it('Cancel button is enabled in determinate mode (progress >= 0)', () => {
    render(<UploadProgressDialog {...defaultProps} progress={50} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).not.toBeDisabled();
  });

  it('Cancel button at progress 0 is enabled (boundary)', () => {
    render(<UploadProgressDialog {...defaultProps} progress={0} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).not.toBeDisabled();
  });

  it('calls onCancel when Cancel is clicked in determinate mode', () => {
    const onCancel = vi.fn();
    render(<UploadProgressDialog {...defaultProps} progress={60} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not call onCancel when Cancel is clicked while disabled (indeterminate)', () => {
    const onCancel = vi.fn();
    render(
      <UploadProgressDialog {...defaultProps} progress={-1} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).not.toHaveBeenCalled();
  });
});
