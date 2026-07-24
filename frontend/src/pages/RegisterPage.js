import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography, Link, Alert,
  InputAdornment, IconButton, CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, PersonOutlined, EmailOutlined, LockOutlined } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register, error, setError } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const updateField = (field, value) => {
    setForm({ ...form, [field]: value });
    setFieldErrors({ ...fieldErrors, [field]: null });
  };

  const validate = () => {
    const errors = {};
    if (!form.nombre.trim()) errors.nombre = 'El nombre es requerido';
    if (!form.email.trim()) errors.email = 'El email es requerido';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Email inválido';
    if (!form.password) errors.password = 'La contraseña es requerida';
    else if (form.password.length < 6) errors.password = 'Mínimo 6 caracteres';
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Las contraseñas no coinciden';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      await register({ nombre: form.nombre, email: form.email, password: form.password });
      navigate('/');
    } catch {
      // error is set by context
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        background: 'radial-gradient(ellipse at top, rgba(124,92,252,0.08) 0%, transparent 60%)',
        p: 2,
      }}
    >
      <Card
        className="liquid-glass"
        sx={{
          maxWidth: 440,
          width: '100%',
          p: { xs: 2, sm: 3 },
          animation: 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(135deg, #f1f1f6, #7c5cfc)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.03em',
                mb: 0.5,
              }}
            >
              Crear Cuenta
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Regístrate para acceder al catálogo
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Nombre" value={form.nombre}
              onChange={(e) => updateField('nombre', e.target.value)}
              error={!!fieldErrors.nombre} helperText={fieldErrors.nombre}
              placeholder="Tu nombre"
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutlined sx={{ color: 'text.disabled', fontSize: 20 }} /></InputAdornment> }}
              sx={{ mb: 2.5 }}
            />
            <TextField
              fullWidth label="Email" type="email" value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              error={!!fieldErrors.email} helperText={fieldErrors.email}
              placeholder="tu@email.com"
              InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined sx={{ color: 'text.disabled', fontSize: 20 }} /></InputAdornment> }}
              sx={{ mb: 2.5 }}
            />
            <TextField
              fullWidth label="Contraseña" type={showPassword ? 'text' : 'password'} value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              error={!!fieldErrors.password} helperText={fieldErrors.password}
              placeholder="••••••••"
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockOutlined sx={{ color: 'text.disabled', fontSize: 20 }} /></InputAdornment>,
                endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">{showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment>,
              }}
              sx={{ mb: 2.5 }}
            />
            <TextField
              fullWidth label="Confirmar Contraseña" type={showPassword ? 'text' : 'password'} value={form.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              error={!!fieldErrors.confirmPassword} helperText={fieldErrors.confirmPassword}
              placeholder="••••••••"
              InputProps={{ startAdornment: <InputAdornment position="start"><LockOutlined sx={{ color: 'text.disabled', fontSize: 20 }} /></InputAdornment> }}
              sx={{ mb: 3 }}
            />

            <Button
              type="submit" fullWidth variant="contained" disabled={loading}
              sx={{ py: 1.3, fontSize: '0.95rem', fontWeight: 600 }}
            >
              {loading ? <CircularProgress size={22} sx={{ color: 'white' }} /> : 'Crear Cuenta'}
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              ¿Ya tienes cuenta?{' '}
              <Link component={RouterLink} to="/login" sx={{ color: 'primary.light', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                Iniciar Sesión
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
