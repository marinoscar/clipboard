import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Archive from '@mui/icons-material/Archive';
import Unarchive from '@mui/icons-material/Unarchive';
import DeleteForever from '@mui/icons-material/DeleteForever';
import { SelectionBar, SelectionAction } from './SelectionBar';

describe('SelectionBar', () => {
  const onDeselectAll = vi.fn();
  const archiveAction: SelectionAction = {
    label: 'Archive Selected',
    icon: Archive,
    onClick: vi.fn(),
    color: 'primary',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when selectedCount is 0', () => {
    render(
      <SelectionBar
        selectedCount={0}
        onDeselectAll={onDeselectAll}
        actions={[archiveAction]}
      />,
    );
    // The Slide component unmounts content when count is 0
    expect(screen.queryByTestId('selection-count')).not.toBeInTheDocument();
  });

  it('renders the selected count when items are selected', () => {
    render(
      <SelectionBar
        selectedCount={3}
        onDeselectAll={onDeselectAll}
        actions={[archiveAction]}
      />,
    );
    expect(screen.getByTestId('selection-count')).toHaveTextContent('3 selected');
  });

  it('renders all action buttons', () => {
    const restoreAction: SelectionAction = {
      label: 'Restore Selected',
      icon: Unarchive,
      onClick: vi.fn(),
      color: 'primary',
    };
    const deleteAction: SelectionAction = {
      label: 'Delete Permanently',
      icon: DeleteForever,
      onClick: vi.fn(),
      color: 'error',
    };

    render(
      <SelectionBar
        selectedCount={2}
        onDeselectAll={onDeselectAll}
        actions={[restoreAction, deleteAction]}
      />,
    );

    expect(screen.getByText('Restore Selected')).toBeInTheDocument();
    expect(screen.getByText('Delete Permanently')).toBeInTheDocument();
  });

  it('calls action onClick when action button is clicked', () => {
    render(
      <SelectionBar
        selectedCount={1}
        onDeselectAll={onDeselectAll}
        actions={[archiveAction]}
      />,
    );

    fireEvent.click(screen.getByText('Archive Selected'));
    expect(archiveAction.onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onDeselectAll when the deselect button is clicked', () => {
    render(
      <SelectionBar
        selectedCount={2}
        onDeselectAll={onDeselectAll}
        actions={[archiveAction]}
      />,
    );

    // The deselect button has a Close icon with a "Deselect all" tooltip
    const closeButton = screen.getByRole('button', { name: /deselect all/i });
    fireEvent.click(closeButton);
    expect(onDeselectAll).toHaveBeenCalledTimes(1);
  });

  it('shows singular "selected" label for count of 1', () => {
    render(
      <SelectionBar
        selectedCount={1}
        onDeselectAll={onDeselectAll}
        actions={[archiveAction]}
      />,
    );
    expect(screen.getByTestId('selection-count')).toHaveTextContent('1 selected');
  });
});
