import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render a spinner', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should render full screen when fullScreen prop is true', () => {
    const { container } = render(<LoadingSpinner fullScreen />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({ height: '100vh' });
  });

  it('should render inline when fullScreen is false', () => {
    const { container } = render(<LoadingSpinner />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).not.toHaveStyle({ height: '100vh' });
  });
});
