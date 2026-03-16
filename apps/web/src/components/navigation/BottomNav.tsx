import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import SettingsIcon from '@mui/icons-material/Settings';
import { useAuth } from '../../contexts/AuthContext';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const pathToValue = (path: string): number => {
    if (path === '/archive') return 1;
    if (path === '/settings') return 2;
    return 0;
  };

  const [value, setValue] = useState(pathToValue(location.pathname));

  useEffect(() => {
    setValue(pathToValue(location.pathname));
  }, [location.pathname]);

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        // Safe area inset for devices with home indicator (iPhone X+)
        pb: 'env(safe-area-inset-bottom)',
      }}
      elevation={3}
    >
      <BottomNavigation
        value={value}
        onChange={(_, newValue) => {
          setValue(newValue);
          const routes = ['/', '/archive', ...(user?.isAdmin ? ['/settings'] : [])];
          navigate(routes[newValue]);
        }}
        showLabels
      >
        {[
          <BottomNavigationAction key="clipboard" label="Clipboard" icon={<ContentPasteIcon />} />,
          <BottomNavigationAction key="archive" label="Archive" icon={<Inventory2Icon />} />,
          ...(user?.isAdmin
            ? [<BottomNavigationAction key="settings" label="Settings" icon={<SettingsIcon />} />]
            : []),
        ]}
      </BottomNavigation>
    </Paper>
  );
}
