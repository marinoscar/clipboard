import { Box, useMediaQuery, useTheme } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { AppHeader } from '../navigation/AppBar';
import { BottomNav } from '../navigation/BottomNav';

export function Layout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppHeader />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1, sm: 2, md: 3 },
          mt: { xs: '56px', sm: '64px' },
          // Extra bottom padding on mobile to account for bottom nav
          pb: isMobile ? '72px' : undefined,
        }}
      >
        <Outlet />
      </Box>
      {isMobile && <BottomNav />}
    </Box>
  );
}
