import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Grid, Alert, AlertTitle,
  Card, CardContent, CircularProgress, Chip, IconButton, InputAdornment,
} from '@mui/material';
import {
  PersonAdd, CheckCircle, Info as InfoIcon, Visibility, VisibilityOff,
} from '@mui/icons-material';
import api from '../../services/api';

const initialForm = {
  nombre: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function CreateUserPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError(null);
    setResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    // Validación local
    if (!form.nombre.trim()) {
      setError('El nombre de usuario es requerido');
      return;
    }
    if (!form.email.trim()) {
      setError('El email es requerido');
      return;
    }
    if (!form.password) {
      setError('La contraseña es requerida');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/usuarios/api/auth/register', {
        nombre: form.nombre,
        email: form.email,
        password: form.password,
      });
      setResult(response.data);
      setForm(initialForm);
    } catch (err) {
      const data = err.response?.data || {};
      if (data.cb_fallback) {
        setError('El servicio de autenticación no está disponible (Circuit Breaker OPEN)');
      } else {
        setError(data.error || 'Error al crear el usuario');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both', maxWidth: 600, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <PersonAdd sx={{ fontSize: 32, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>Crear Usuario</Typography>
          <Typography variant="body2" color="text.secondary">
            Crea cuentas de usuario para probar el sistema. Los datos se replican automáticamente.
          </Typography>
        </Box>
      </Box>

      {/* Replication Info */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{ mb: 3, borderRadius: 2, bgcolor: 'rgba(2,136,209,0.08)', border: '1px solid', borderColor: 'info.main' }}
      >
        <AlertTitle sx={{ fontWeight: 700, mb: 0.5 }}>Replicación de Usuarios</AlertTitle>
        <Typography variant="body2">
          Al crear un usuario, el ReplicationLogWriter registra la operación y
          los cambios se replican a las 3 réplicas de la base de datos MySQL.
        </Typography>
      </Alert>

      {/* Success */}
      {result && (
        <Alert
          severity="success"
          icon={<CheckCircle />}
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button size="small" onClick={() => navigate('/admin/replication')}>
              Ver Replicación
            </Button>
          }
        >
          <AlertTitle sx={{ fontWeight: 700, mb: 0.5 }}>Usuario Creado ✅</AlertTitle>
          <Typography variant="body2">
            <strong>{result.username}</strong> — ID: {result.userId} | Email: {form.email}
          </Typography>
        </Alert>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>
      )}

      {/* Form */}
      <Card sx={{ borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <CardContent sx={{ p: 3 }}>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2.5}>
              {/* Username */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nombre de usuario *"
                  value={form.nombre}
                  onChange={handleChange('nombre')}
                  placeholder="Ej: juan_perez"
                  required
                  autoComplete="off"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Email */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email *"
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  placeholder="ejemplo@correo.com"
                  required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Password */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Contraseña *"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange('password')}
                  placeholder="Mín. 6 caracteres"
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Confirm Password */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Confirmar contraseña *"
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  placeholder="Repite la contraseña"
                  required
                  error={form.confirmPassword.length > 0 && form.password !== form.confirmPassword}
                  helperText={
                    form.confirmPassword.length > 0 && form.password !== form.confirmPassword
                      ? 'Las contraseñas no coinciden'
                      : ''
                  }
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>
            </Grid>

            {/* Submit */}
            <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/admin')}
                sx={{ borderRadius: 2 }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={loading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <PersonAdd />}
                disabled={loading}
                sx={{ borderRadius: 2, px: 4 }}
              >
                {loading ? 'Creando...' : 'Crear Usuario'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Hint */}
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          💡 Después de crear, revisa{' '}
          <Chip
            label="Replicación"
            size="small"
            component="a"
            href="/admin/replication"
            clickable
            sx={{ cursor: 'pointer', fontWeight: 600 }}
            onClick={(e) => { e.preventDefault(); navigate('/admin/replication'); }}
          />{' '}
          para ver cómo los datos se propagan a las réplicas.
        </Typography>
      </Box>
    </Box>
  );
}
