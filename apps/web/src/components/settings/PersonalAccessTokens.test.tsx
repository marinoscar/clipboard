import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../services/api', () => ({
  listPersonalAccessTokens: vi.fn(),
  createPersonalAccessToken: vi.fn(),
  revokePersonalAccessToken: vi.fn(),
}));

import { PersonalAccessTokens } from './PersonalAccessTokens';
import {
  listPersonalAccessTokens,
  createPersonalAccessToken,
  revokePersonalAccessToken,
} from '../../services/api';

const mockList = listPersonalAccessTokens as ReturnType<typeof vi.fn>;
const mockCreate = createPersonalAccessToken as ReturnType<typeof vi.fn>;
const mockRevoke = revokePersonalAccessToken as ReturnType<typeof vi.fn>;

const futureDate = new Date(Date.now() + 86400_000 * 30).toISOString();
const farFuture = new Date(2126, 0, 1).toISOString();

const mockTokens = [
  { id: 'pat-1', name: 'CLI Token', lastChars: 'ab12', expiresAt: futureDate, createdAt: new Date().toISOString(), revokedAt: null },
  { id: 'pat-2', name: 'Old Token', lastChars: 'cd34', expiresAt: futureDate, createdAt: new Date().toISOString(), revokedAt: new Date().toISOString() },
];

describe('PersonalAccessTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue([]);
  });

  it('renders loading state then empty message', async () => {
    render(<PersonalAccessTokens />);
    await waitFor(() => {
      expect(screen.getByText(/no personal access tokens/i)).toBeInTheDocument();
    });
  });

  it('renders token list', async () => {
    mockList.mockResolvedValue(mockTokens);
    render(<PersonalAccessTokens />);

    await waitFor(() => {
      expect(screen.getByText('CLI Token')).toBeInTheDocument();
      expect(screen.getByText('Old Token')).toBeInTheDocument();
    });

    expect(screen.getByText('clip_...ab12')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Revoked')).toBeInTheDocument();
  });

  it('opens create dialog and creates a token', async () => {
    mockList.mockResolvedValue([]);
    mockCreate.mockResolvedValue({
      token: 'clip_abcdef1234567890abcdef1234567890',
      id: 'pat-new',
      name: 'New Token',
      lastChars: '7890',
      expiresAt: futureDate,
      createdAt: new Date().toISOString(),
      revokedAt: null,
    });

    render(<PersonalAccessTokens />);

    await waitFor(() => {
      expect(screen.getByText(/create token/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/create token/i));

    await waitFor(() => {
      expect(screen.getByText('Create Personal Access Token')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/token name/i);
    await userEvent.type(nameInput, 'New Token');

    const createButton = screen.getAllByRole('button').find(
      (btn) => btn.textContent === 'Create',
    );
    fireEvent.click(createButton!);

    await waitFor(() => {
      expect(screen.getByText(/copy this token now/i)).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('clip_abcdef1234567890abcdef1234567890')).toBeInTheDocument();
  });

  it('opens revoke confirmation dialog', async () => {
    mockList.mockResolvedValue([mockTokens[0]]);
    mockRevoke.mockResolvedValue(undefined);

    render(<PersonalAccessTokens />);

    await waitFor(() => {
      expect(screen.getByText('CLI Token')).toBeInTheDocument();
    });

    const revokeButton = screen.getByRole('button', { name: /revoke/i });
    fireEvent.click(revokeButton);

    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /^revoke$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockRevoke).toHaveBeenCalledWith('pat-1');
    });
  });
});
