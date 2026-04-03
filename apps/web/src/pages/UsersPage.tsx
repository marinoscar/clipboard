import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { listUsers, addUser, removeUser, ManagedUser } from '../services/api';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function UsersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);

  // Remove dialog
  const [removeTarget, setRemoveTarget] = useState<ManagedUser | null>(null);
  const [removing, setRemoving] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isAdmin) {
      loadUsers();
    }
  }, [user, loadUsers]);

  const handleAdd = async () => {
    setAdding(true);
    try {
      await addUser(newEmail);
      setAddOpen(false);
      setNewEmail('');
      setSnackbar({ open: true, message: `User ${newEmail} added successfully.`, severity: 'success' });
      await loadUsers();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to add user',
        severity: 'error',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeUser(removeTarget.id);
      setRemoveTarget(null);
      setSnackbar({ open: true, message: `User ${removeTarget.email} removed.`, severity: 'success' });
      await loadUsers();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to remove user',
        severity: 'error',
      });
    } finally {
      setRemoving(false);
    }
  };

  if (authLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Users
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage who can access this Clipboard instance. Only listed users can log in.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => setAddOpen(true)}
        >
          Add User
        </Button>
      </Box>

      <Paper variant="outlined">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <LoadingSpinner />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Added</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.displayName || '-'}</TableCell>
                    <TableCell>
                      {u.googleId ? (
                        <Chip label="Active" color="success" size="small" />
                      ) : (
                        <Chip label="Invited" color="warning" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      {u.isAdmin ? (
                        <Chip label="Admin" color="primary" size="small" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">User</Typography>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(u.createdAt)}</TableCell>
                    <TableCell align="right">
                      {u.id !== user.id ? (
                        <Tooltip title="Remove user">
                          <IconButton size="small" onClick={() => setRemoveTarget(u)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.secondary">You</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add User</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the Gmail address of the person you want to grant access to.
            They will be able to log in with their Google account.
          </Typography>
          <TextField
            label="Email address"
            type="email"
            placeholder="user@gmail.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!newEmail.trim() || adding}
            startIcon={adding ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {adding ? 'Adding...' : 'Add User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog open={!!removeTarget} onClose={() => setRemoveTarget(null)}>
        <DialogTitle>Remove User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove <strong>{removeTarget?.email}</strong>?
            They will lose access and all their clipboard items will be deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRemove}
            disabled={removing}
            startIcon={removing ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {removing ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
