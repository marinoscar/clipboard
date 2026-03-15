import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Slide from '@mui/material/Slide';
import CloseIcon from '@mui/icons-material/Close';
import { SvgIconComponent } from '@mui/icons-material';

export interface SelectionAction {
  label: string;
  icon: SvgIconComponent;
  onClick: () => void;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'inherit';
}

interface SelectionBarProps {
  selectedCount: number;
  onDeselectAll: () => void;
  actions: SelectionAction[];
}

export function SelectionBar({ selectedCount, onDeselectAll, actions }: SelectionBarProps) {
  const visible = selectedCount > 0;

  return (
    <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: { xs: 16, md: 24 },
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: (theme) => theme.zIndex.snackbar,
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, sm: 2 },
          px: { xs: 2, sm: 3 },
          py: 1.5,
          borderRadius: 3,
          minWidth: { xs: 'calc(100vw - 32px)', sm: 'auto' },
          maxWidth: { xs: 'calc(100vw - 32px)', sm: 600 },
          flexWrap: 'wrap',
        }}
      >
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{ flexShrink: 0, minWidth: 80 }}
          data-testid="selection-count"
        >
          {selectedCount} selected
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flex: 1, flexWrap: 'wrap' }}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.label}
                size="small"
                variant="contained"
                color={action.color ?? 'primary'}
                startIcon={<Icon fontSize="small" />}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            );
          })}
        </Box>

        <Tooltip title="Deselect all">
          <IconButton size="small" onClick={onDeselectAll} sx={{ flexShrink: 0 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>
    </Slide>
  );
}
