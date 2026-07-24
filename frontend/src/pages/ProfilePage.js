import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button, Avatar, Grid,
  Divider, Chip, Alert, Snackbar, IconButton,
} from '@mui/material';
import { Edit, Save, Cancel, Person, Email, Badge } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';

export default function ProfilePage() {
  const { user, isAdmin, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nombre: user?.name || '', email: user?.email || '' });
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const handleSave = async () => {
    setSaving(true);
    try {
      await authService.updateProfile({ nombre: form.nombre, email: form.email });
      setSnackbar({ open: true, message: 'Perfil actualizado', severity: 'success' });
      setEditing(false);
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const userName = user?.name || user?.email?.split('@')[0] || 'Usuario';

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <Typography variant="h4" fontWeight={800} sx={{ mb: 3, letterSpacing: '-0.02em' }}>
        Mi Perfil
      </Typography>

      <Grid container spacing={3}>
        {/* Profile Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, textAlign: 'center', p: 3 }}>
            <Avatar
              sx={{
                width: 80, height: 80, mx: 'auto', mb: 2,
                bgcolor: 'primary.main', fontSize: '2rem', fontWeight: 700,
                boxShadow: '0 0 24px rgba(124,92,252,0.3)',
              }}
            >
              {userName.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="h6" fontWeight={700}>{userName}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{user?.email}</Typography>
            <Chip
              label={isAdmin ? 'ADMINISTRADOR' : 'USUARIO'}
              color={isAdmin ? 'warning' : 'primary'}
              size="small"
              sx={{ fontWeight: 600, fontSize: '0.7rem' }}
            />
          </Card>
        </Grid>

        {/* Edit Form */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6" fontWeight={600}>Información Personal</Typography>
                {!editing ? (
                  <Button startIcon={<Edit />} onClick={() => setEditing(true)} size="small">
                    Editar
                  </Button>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button startIcon={<Cancel />} onClick={() => setEditing(false)} size="small" color="error">
                      Cancelar
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<Save />}
                      onClick={handleSave}
                      size="small"
                      disabled={saving}
                    >
                      {saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </Box>
                )}
              </Box>

              <Divider sx={{ mb: 3, borderColor: 'rgba(255,255,255,0.06)' }} />

              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Nombre"
                    value={editing ? form.nombre : userName}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    disabled={!editing}
                    InputProps={{
                      startAdornment: <Badge sx={{ mr: 1, color: 'text.disabled', fontSize: 20 }} />,
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={editing ? form.email : user?.email || ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    disabled={!editing}
                    InputProps={{
                      startAdornment: <Email sx={{ mr: 1, color: 'text.disabled', fontSize: 20 }} />,
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Rol"
                    value={isAdmin ? 'Administrador' : 'Usuario'}
                    disabled
                    InputProps={{
                      startAdornment: <Person sx={{ mr: 1, color: 'text.disabled', fontSize: 20 }} />,
                    }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ borderRadius: 2 }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
