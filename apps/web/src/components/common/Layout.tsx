import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { AppHeader } from '../navigation/AppBar';

export function Layout() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppHeader />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1, sm: 2, md: 3 },
          mt: { xs: '56px', sm: '64px' },
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
