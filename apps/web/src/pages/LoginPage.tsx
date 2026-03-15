import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Divider,
  useTheme,
} from '@mui/material';
import { ContentPaste as ClipboardIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { OAuthButton } from '../components/auth/OAuthButton';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface LocationState {
  from?: { pathname: string; search: string };
}

export default function LoginPage() {
  const { isAuthenticated, isLoading, providers, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const state = location.state as LocationState | null;
  const returnUrl = state?.from
    ? `${state.from.pathname}${state.from.search || ''}`
    : '/';

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate(returnUrl, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, returnUrl]);

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.palette.background.default,
        p: 2,
      }}
    >
      <Card
        sx={{
          maxWidth: 400,
          width: '100%',
          boxShadow: theme.shadows[10],
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <ClipboardIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" component="h1" fontWeight="bold">
              Clipboard
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Your universal clipboard across all devices
            </Typography>
          </Box>

          <Divider sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Sign in with
            </Typography>
          </Divider>

          <Stack spacing={2}>
            {providers.length > 0 ? (
              providers.map((provider) => (
                <OAuthButton
                  key={provider.name}
                  provider={provider.name}
                  onClick={() => login(provider.name)}
                />
              ))
            ) : (
              <Typography color="text.secondary" textAlign="center">
                No authentication providers configured
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
