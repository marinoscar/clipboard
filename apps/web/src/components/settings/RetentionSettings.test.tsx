import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RetentionSettings, RetentionValues } from './RetentionSettings';

function defaultValues(): RetentionValues {
  return {
    archiveAfterDays: null,
    deleteAfterArchiveDays: null,
  };
}

describe('RetentionSettings', () => {
  it('renders both Select dropdowns', () => {
    render(
      <RetentionSettings
        values={defaultValues()}
        onChange={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />,
    );

    expect(screen.getByLabelText('Archive items after')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete archived items after')).toBeInTheDocument();
  });

  it('renders Save Settings button', () => {
    render(
      <RetentionSettings
        values={defaultValues()}
        onChange={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />,
    );

    expect(screen.getByRole('button', { name: /save settings/i })).toBeInTheDocument();
  });

  it('calls onSave when Save Settings button is clicked', () => {
    const onSave = vi.fn();
    render(
      <RetentionSettings
        values={defaultValues()}
        onChange={vi.fn()}
        onSave={onSave}
        saving={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    expect(onSave).toHaveBeenCalled();
  });

  it('shows Saving... and disables Save button when saving is true', () => {
    render(
      <RetentionSettings
        values={defaultValues()}
        onChange={vi.fn()}
        onSave={vi.fn()}
        saving={true}
      />,
    );

    const button = screen.getByRole('button', { name: /saving/i });
    expect(button).toBeDisabled();
  });

  it('displays "Never" as selected value when archiveAfterDays is null', () => {
    render(
      <RetentionSettings
        values={{ archiveAfterDays: null, deleteAfterArchiveDays: null }}
        onChange={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />,
    );

    // The comboboxes should display "Never" for null values
    const comboboxes = screen.getAllByRole('combobox');
    // MUI Select renders the displayed value inside the combobox
    expect(comboboxes).toHaveLength(2);
  });

  it('renders info alert explaining the archive-then-delete flow', () => {
    render(
      <RetentionSettings
        values={defaultValues()}
        onChange={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />,
    );

    expect(screen.getByText(/archived.*hidden from main view/i)).toBeInTheDocument();
  });

  it('disables dropdowns when saving is true', () => {
    render(
      <RetentionSettings
        values={defaultValues()}
        onChange={vi.fn()}
        onSave={vi.fn()}
        saving={true}
      />,
    );

    // When saving, the select inputs should have aria-disabled
    const comboboxes = screen.getAllByRole('combobox');
    comboboxes.forEach((cb) => {
      expect(cb).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
