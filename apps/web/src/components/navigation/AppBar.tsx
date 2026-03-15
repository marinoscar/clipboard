import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Tooltip,
} from '@mui/material';
import {
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  ContentPaste as ClipboardIcon,
  Inventory2 as ArchiveIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useThemeContext } from '../../contexts/ThemeContext';
import { UserMenu } from './UserMenu';

export function AppHeader() {
  const { isDarkMode, toggleMode } = useThemeContext();
  const navigate = useNavigate();

  return (
    <AppBar
      position="fixed"
      color="default"
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
    >
      <Toolbar>
        <ClipboardIcon sx={{ mr: 1 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 2 }}>
          Clipboard
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        <Tooltip title="Archive">
          <IconButton onClick={() => navigate('/archive')} color="inherit" sx={{ mr: 0.5 }}>
            <ArchiveIcon />
          </IconButton>
        </Tooltip>

        <IconButton onClick={toggleMode} color="inherit" sx={{ mr: 1 }}>
          {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>

        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}
