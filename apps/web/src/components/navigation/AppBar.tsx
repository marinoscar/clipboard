import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
} from '@mui/material';
import {
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  ContentPaste as ClipboardIcon,
} from '@mui/icons-material';
import { useThemeContext } from '../../contexts/ThemeContext';
import { UserMenu } from './UserMenu';

export function AppHeader() {
  const { isDarkMode, toggleMode } = useThemeContext();

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

        <IconButton onClick={toggleMode} color="inherit" sx={{ mr: 1 }}>
          {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>

        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}
