import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import ContentCopy from '@mui/icons-material/ContentCopy';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import {
  PersonalAccessToken,
  createPersonalAccessToken,
  listPersonalAccessTokens,
  revokePersonalAccessToken,
} from '../../services/api';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

function isNeverExpires(expiresAt: string): boolean {
  return new Date(expiresAt).getFullYear() > new Date().getFullYear() + 50;
}

export function PersonalAccessTokens() {
  const [tokens, setTokens] = useState<PersonalAccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newExpiration, setNewExpiration] = useState<'1d' | '30d' | 'never'>('30d');
  const [creating, setCreating] = useState(false);

  // Token display dialog (shown once after creation)
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<PersonalAccessToken | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPersonalAccessTokens();
      setTokens(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await createPersonalAccessToken(newName, newExpiration);
      setCreatedToken(result.token);
      setCreateOpen(false);
      setNewName('');
      setNewExpiration('30d');
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokePersonalAccessToken(revokeTarget.id);
      setRevokeTarget(null);
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke token');
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = async () => {
    if (createdToken) {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const activeTokens = tokens.filter((t) => !t.revokedAt);
  const revokedTokens = tokens.filter((t) => t.revokedAt);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Tokens are used to authenticate CLI tools and API integrations.
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          Create Token
        </Button>
      </Box>

      {activeTokens.length === 0 && revokedTokens.length === 0 ? (
        <Alert severity="info">No personal access tokens yet. Create one to get started.</Alert>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Token</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activeTokens.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      clip_...{t.lastChars}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDate(t.createdAt)}</TableCell>
                  <TableCell>
                    {isNeverExpires(t.expiresAt) ? 'Never' : formatDate(t.expiresAt)}
                  </TableCell>
                  <TableCell>
                    {isExpired(t.expiresAt) ? (
                      <Chip label="Expired" color="error" size="small" />
                    ) : (
                      <Chip label="Active" color="success" size="small" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Revoke">
                      <IconButton size="small" onClick={() => setRevokeTarget(t)}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {revokedTokens.map((t) => (
                <TableRow key={t.id} sx={{ opacity: 0.5 }}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      clip_...{t.lastChars}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDate(t.createdAt)}</TableCell>
                  <TableCell>
                    {isNeverExpires(t.expiresAt) ? 'Never' : formatDate(t.expiresAt)}
                  </TableCell>
                  <TableCell>
                    <Chip label="Revoked" size="small" />
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create Token Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Personal Access Token</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Token name"
              placeholder="e.g. CLI on laptop"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              fullWidth
              autoFocus
            />
            <FormControl fullWidth>
              <InputLabel id="expiration-label">Expiration</InputLabel>
              <Select
                labelId="expiration-label"
                label="Expiration"
                value={newExpiration}
                onChange={(e) => setNewExpiration(e.target.value as '1d' | '30d' | 'never')}
              >
                <MenuItem value="1d">1 day</MenuItem>
                <MenuItem value="30d">30 days</MenuItem>
                <MenuItem value="never">Never</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            startIcon={creating ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Token Display Dialog (shown once) */}
      <Dialog
        open={!!createdToken}
        onClose={() => { setCreatedToken(null); setCopied(false); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Token Created</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Copy this token now. You will not be able to see it again.
          </Alert>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              value={createdToken || ''}
              fullWidth
              InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
            />
            <Tooltip title={copied ? 'Copied!' : 'Copy'}>
              <IconButton onClick={handleCopy}>
                <ContentCopy />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => { setCreatedToken(null); setCopied(false); }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)}>
        <DialogTitle>Revoke Token</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to revoke <strong>{revokeTarget?.name}</strong>? Any applications using this token will lose access.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRevoke}
            disabled={revoking}
            startIcon={revoking ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {revoking ? 'Revoking...' : 'Revoke'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
