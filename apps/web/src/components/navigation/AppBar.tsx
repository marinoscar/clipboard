import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ContentPaste as ClipboardIcon,
  Inventory2 as ArchiveIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { UserMenu } from './UserMenu';

export function AppHeader() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <AppBar
      position="fixed"
      color="default"
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
    >
      <Toolbar>
        <Box
          onClick={() => navigate('/')}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mr: 2 }}
        >
          <ClipboardIcon sx={{ mr: 1 }} />
          <Typography variant="h6" component="div">
            Clipboard
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        {/* Hide archive button on mobile - available in bottom nav */}
        {!isMobile && (
          <Tooltip title="Archive">
            <IconButton onClick={() => navigate('/archive')} color="inherit" sx={{ mr: 0.5 }}>
              <ArchiveIcon />
            </IconButton>
          </Tooltip>
        )}

        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}
