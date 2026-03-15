import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Save from '@mui/icons-material/Save';

const RETENTION_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Never', value: null },
  { label: '1 day', value: 1 },
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '1 year', value: 365 },
];

export interface RetentionValues {
  archiveAfterDays: number | null;
  deleteAfterArchiveDays: number | null;
}

interface RetentionSettingsProps {
  values: RetentionValues;
  onChange: (values: RetentionValues) => void;
  onSave: () => void;
  saving: boolean;
}

function serializeValue(value: number | null): string {
  return value === null ? 'never' : String(value);
}

function deserializeValue(raw: string): number | null {
  return raw === 'never' ? null : Number(raw);
}

export function RetentionSettings({ values, onChange, onSave, saving }: RetentionSettingsProps) {
  const handleArchiveChange = (e: SelectChangeEvent) => {
    onChange({ ...values, archiveAfterDays: deserializeValue(e.target.value) });
  };

  const handleDeleteChange = (e: SelectChangeEvent) => {
    onChange({ ...values, deleteAfterArchiveDays: deserializeValue(e.target.value) });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Retention Policy
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          Items are first archived (hidden from main view) and then permanently deleted after the archive period. Setting a policy to "Never" disables that step.
        </Alert>
      </Box>

      <FormControl fullWidth>
        <InputLabel id="archive-after-label">Archive items after</InputLabel>
        <Select
          labelId="archive-after-label"
          label="Archive items after"
          value={serializeValue(values.archiveAfterDays)}
          onChange={handleArchiveChange}
          disabled={saving}
        >
          {RETENTION_OPTIONS.map(({ label, value }) => (
            <MenuItem key={serializeValue(value)} value={serializeValue(value)}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth>
        <InputLabel id="delete-after-label">Delete archived items after</InputLabel>
        <Select
          labelId="delete-after-label"
          label="Delete archived items after"
          value={serializeValue(values.deleteAfterArchiveDays)}
          onChange={handleDeleteChange}
          disabled={saving}
        >
          {RETENTION_OPTIONS.map(({ label, value }) => (
            <MenuItem key={serializeValue(value)} value={serializeValue(value)}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={onSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>
    </Box>
  );
}
