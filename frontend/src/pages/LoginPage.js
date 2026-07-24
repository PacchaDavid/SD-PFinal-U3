import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography, Link, Alert,
  InputAdornment, IconButton, CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, EmailOutlined, LockOutlined } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, error, setError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!email.trim()) errors.email = 'El email es requerido';
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = 'Email inválido';
    if (!password) errors.password = 'La contraseña es requerida';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email, password);
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
          maxWidth: 420,
          width: '100%',
          p: { xs: 2, sm: 3 },
          animation: 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          {/* Logo */}
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
              StreamHub
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Inicia sesión en tu cuenta
            </Typography>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors({ ...fieldErrors, email: null }); }}
              error={!!fieldErrors.email}
              helperText={fieldErrors.email}
              placeholder="tu@email.com"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlined sx={{ color: 'text.disabled', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2.5 }}
            />

            <TextField
              fullWidth
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors({ ...fieldErrors, password: null }); }}
              error={!!fieldErrors.password}
              helperText={fieldErrors.password}
              placeholder="••••••••"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined sx={{ color: 'text.disabled', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{
                py: 1.3,
                fontSize: '0.95rem',
                fontWeight: 600,
                bgcolor: 'primary.main',
                '&:hover': { boxShadow: '0 4px 24px rgba(124,92,252,0.4)' },
              }}
            >
              {loading ? <CircularProgress size={22} sx={{ color: 'white' }} /> : 'Iniciar Sesión'}
            </Button>
          </Box>

          {/* Register Link */}
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              ¿No tienes cuenta?{' '}
              <Link
                component={RouterLink}
                to="/register"
                sx={{ color: 'primary.light', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                Registrarse
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
