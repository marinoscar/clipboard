import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function ThrowingComponent({ error }: { error: Error }): JSX.Element {
  throw error;
}

describe('ErrorBoundary', () => {
  // Suppress console.error for expected errors
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should render error message when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Test error')} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should render reload button', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Crash')} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });
});
