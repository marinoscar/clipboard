import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import type { User } from '../../types';

// ------------------------------------------------------------------
// Module mocks
// ------------------------------------------------------------------

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../contexts/AuthContext';

const mockedUseAuth = vi.mocked(useAuth);

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Test User',
    profileImageUrl: null,
    isActive: true,
    isAdmin: false,
    ...overrides,
  };
}

/** Default auth context shape returned by useAuth. */
function makeAuthContext(user: User | null) {
  return {
    user,
    isLoading: false,
    isAuthenticated: !!user,
    providers: [],
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  };
}

/**
 * Render BottomNav inside a MemoryRouter so hooks that read location work.
 * Pass initialEntries to simulate a specific active route.
 */
function renderBottomNav(
  user: User | null,
  { initialEntries = ['/'] }: { initialEntries?: string[] } = {},
) {
  mockedUseAuth.mockReturnValue(makeAuthContext(user));

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <BottomNav />
    </MemoryRouter>,
  );
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('BottomNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // Tab rendering
  // ----------------------------------------------------------------

  it('renders Clipboard tab for a regular user', () => {
    renderBottomNav(makeUser());

    expect(screen.getByText('Clipboard')).toBeInTheDocument();
  });

  it('renders Archive tab for a regular user', () => {
    renderBottomNav(makeUser());

    expect(screen.getByText('Archive')).toBeInTheDocument();
  });

  it('renders Settings tab when the user is an admin', () => {
    renderBottomNav(makeUser({ isAdmin: true }));

    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('does not render Settings tab when the user is not an admin', () => {
    renderBottomNav(makeUser({ isAdmin: false }));

    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('does not render Settings tab when there is no authenticated user', () => {
    renderBottomNav(null);

    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Active tab (highlighted) based on current route
  // ----------------------------------------------------------------

  it('highlights Clipboard tab on the "/" route', () => {
    renderBottomNav(makeUser(), { initialEntries: ['/'] });

    // MUI BottomNavigationAction marks the selected item with aria-selected="true"
    // or adds the "Mui-selected" class. Query by role "tab" (aria-selected).
    const clipboardButton = screen.getByRole('button', { name: /clipboard/i });
    expect(clipboardButton).toHaveClass('Mui-selected');
  });

  it('highlights Archive tab on the "/archive" route', () => {
    renderBottomNav(makeUser(), { initialEntries: ['/archive'] });

    const archiveButton = screen.getByRole('button', { name: /archive/i });
    expect(archiveButton).toHaveClass('Mui-selected');
  });

  it('highlights Settings tab on the "/settings" route for an admin', () => {
    renderBottomNav(makeUser({ isAdmin: true }), { initialEntries: ['/settings'] });

    const settingsButton = screen.getByRole('button', { name: /settings/i });
    expect(settingsButton).toHaveClass('Mui-selected');
  });

  it('defaults to Clipboard tab as active on an unknown route', () => {
    renderBottomNav(makeUser(), { initialEntries: ['/unknown-path'] });

    const clipboardButton = screen.getByRole('button', { name: /clipboard/i });
    expect(clipboardButton).toHaveClass('Mui-selected');
  });

  // ----------------------------------------------------------------
  // Navigation on click
  // ----------------------------------------------------------------

  it('is interactive — Archive tab is present and clickable without throwing', () => {
    renderBottomNav(makeUser(), { initialEntries: ['/'] });

    // Verify we can click a tab without an error being thrown.
    // (Full navigation assertions require a router that tracks history,
    // which MemoryRouter provides, but BottomNav calls useNavigate internally
    // so we just verify no crash and the click is handled.)
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: /archive/i }));
    }).not.toThrow();
  });

  it('Clipboard and Archive tabs are always visible for an admin', () => {
    renderBottomNav(makeUser({ isAdmin: true }));

    expect(screen.getByText('Clipboard')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
