import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import ShareTargetPage from './ShareTargetPage';

// ------------------------------------------------------------------
// Module mocks
// ------------------------------------------------------------------

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

vi.mock('../services/api', () => ({
  createTextItem: vi.fn(),
  uploadFile: vi.fn(),
}));

import { useNavigate } from 'react-router-dom';
import { createTextItem, uploadFile } from '../services/api';

const mockedUseNavigate = vi.mocked(useNavigate);
const mockedCreateTextItem = vi.mocked(createTextItem);
const mockedUploadFile = vi.mocked(uploadFile);

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

/** Simulate a service-worker 'message' event with share-target data. */
function fireServiceWorkerMessage(data: Record<string, unknown>) {
  // Grab the handler registered via navigator.serviceWorker.addEventListener
  const calls = (navigator.serviceWorker.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
  const messageHandlers = calls
    .filter(([event]: [string]) => event === 'message')
    .map(([, handler]: [string, (e: MessageEvent) => void]) => handler);

  const event = new MessageEvent('message', { data });
  messageHandlers.forEach((h) => h(event));
}

// ------------------------------------------------------------------
// Setup
// ------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default navigate mock
  mockedUseNavigate.mockReturnValue(vi.fn());

  // Mock navigator.serviceWorker
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    writable: true,
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });

  // Restore window.location.search to empty by default
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...window.location, search: '' },
  });
});

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('ShareTargetPage', () => {
  it('shows "Saving shared content..." spinner initially', () => {
    render(<ShareTargetPage />, { wrapper });

    expect(screen.getByText('Saving shared content...')).toBeInTheDocument();
    // MUI CircularProgress renders a role="progressbar"
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('calls createTextItem and redirects home when a text share-target message arrives', async () => {
    const mockNavigate = vi.fn();
    mockedUseNavigate.mockReturnValue(mockNavigate);
    mockedCreateTextItem.mockResolvedValue({} as never);

    render(<ShareTargetPage />, { wrapper });

    fireServiceWorkerMessage({ type: 'share-target', text: 'Hello from share' });

    await waitFor(() => {
      expect(mockedCreateTextItem).toHaveBeenCalledWith('Hello from share');
    });

    await waitFor(() => {
      expect(screen.getByText(/Content saved to clipboard/i)).toBeInTheDocument();
    });

    // Navigation is deferred by 1.5 s — use fake timers would be ideal, but
    // waitFor polling is sufficient to observe the success state here.
  });

  it('calls uploadFile and shows success when a file share-target message arrives', async () => {
    const mockNavigate = vi.fn();
    mockedUseNavigate.mockReturnValue(mockNavigate);
    mockedUploadFile.mockResolvedValue({} as never);

    render(<ShareTargetPage />, { wrapper });

    const file = new File(['data'], 'image.png', { type: 'image/png' });
    fireServiceWorkerMessage({ type: 'share-target', file });

    await waitFor(() => {
      expect(mockedUploadFile).toHaveBeenCalledWith(file);
    });

    await waitFor(() => {
      expect(screen.getByText(/Content saved to clipboard/i)).toBeInTheDocument();
    });
  });

  it('shows an error alert when createTextItem rejects', async () => {
    mockedUseNavigate.mockReturnValue(vi.fn());
    mockedCreateTextItem.mockRejectedValue(new Error('Server unavailable'));

    render(<ShareTargetPage />, { wrapper });

    fireServiceWorkerMessage({ type: 'share-target', text: 'some text' });

    await waitFor(() => {
      expect(screen.getByText('Server unavailable')).toBeInTheDocument();
    });

    // Should show an MUI error Alert (role="alert")
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows a generic error message when the rejection is not an Error instance', async () => {
    mockedUseNavigate.mockReturnValue(vi.fn());
    mockedCreateTextItem.mockRejectedValue('unexpected string rejection');

    render(<ShareTargetPage />, { wrapper });

    fireServiceWorkerMessage({ type: 'share-target', text: 'some text' });

    await waitFor(() => {
      expect(screen.getByText('Failed to save shared content')).toBeInTheDocument();
    });
  });

  it('shows an error alert when uploadFile rejects', async () => {
    mockedUseNavigate.mockReturnValue(vi.fn());
    mockedUploadFile.mockRejectedValue(new Error('Upload failed'));

    render(<ShareTargetPage />, { wrapper });

    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
    fireServiceWorkerMessage({ type: 'share-target', file });

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument();
    });
  });

  it('ignores message events whose type is not "share-target"', async () => {
    mockedUseNavigate.mockReturnValue(vi.fn());

    render(<ShareTargetPage />, { wrapper });

    fireServiceWorkerMessage({ type: 'other-event', text: 'ignored' });

    // Should remain in processing state — no API calls fired
    expect(mockedCreateTextItem).not.toHaveBeenCalled();
    expect(mockedUploadFile).not.toHaveBeenCalled();
    expect(screen.getByText('Saving shared content...')).toBeInTheDocument();
  });

  it('registers and removes service-worker message listener on mount/unmount', () => {
    mockedUseNavigate.mockReturnValue(vi.fn());

    const { unmount } = render(<ShareTargetPage />, { wrapper });

    expect(navigator.serviceWorker.addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );

    unmount();

    expect(navigator.serviceWorker.removeEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );
  });
});
