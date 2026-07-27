import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Grid, MenuItem, Alert, AlertTitle,
  Card, CardContent, CircularProgress, Chip,
} from '@mui/material';
import {
  MovieCreation, Add, CheckCircle, Info as InfoIcon,
} from '@mui/icons-material';
import api from '../../services/api';

const GENRES = [
  'Acción', 'Aventura', 'Comedia', 'Drama', 'Terror',
  'Ciencia Ficción', 'Romance', 'Suspenso', 'Animación', 'Documental',
  'Crimen', 'Fantasía', 'Thriller',
];

const RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17'];

const initialForm = {
  title: '',
  description: '',
  genre: 'Acción',
  durationMinutes: 120,
  releaseYear: new Date().getFullYear(),
  rating: 'PG-13',
  imdbRating: 7.0,
  director: '',
  cast: '',
  posterUrl: '',
  price: 4.99,
  featured: false,
};

export default function CreateMoviePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.post('/api/recomendaciones/api/recomendaciones', {
        title: form.title,
        description: form.description,
        genre: form.genre,
        durationMinutes: parseInt(form.durationMinutes),
        releaseYear: parseInt(form.releaseYear),
        rating: form.rating,
        imdbRating: parseFloat(form.imdbRating),
        director: form.director,
        cast: form.cast,
        posterUrl: form.posterUrl || undefined,
        price: parseFloat(form.price),
        featured: form.featured,
      });
      setResult(response.data);
      setForm(initialForm);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al crear la película';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both', maxWidth: 900, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <MovieCreation sx={{ fontSize: 32, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>Crear Película</Typography>
          <Typography variant="body2" color="text.secondary">
            Las películas creadas aquí se replican automáticamente a las réplicas de la base de datos
          </Typography>
        </Box>
      </Box>

      {/* Replication Info */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{ mb: 3, borderRadius: 2, bgcolor: 'rgba(2,136,209,0.08)', border: '1px solid', borderColor: 'info.main' }}
      >
        <AlertTitle sx={{ fontWeight: 700, mb: 0.5 }}>Replicación Automática</AlertTitle>
        <Typography variant="body2">
          Al crear una película, los datos se escriben en la base de datos primaria (primaria) y
          se replican automáticamente a las 3 réplicas mediante MariaDB binlog.
          Puedes verificar el estado en la sección <strong>Replicación</strong> del panel.
        </Typography>
      </Alert>

      {/* Success Result */}
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
          <AlertTitle sx={{ fontWeight: 700, mb: 0.5 }}>Película Creada ✅</AlertTitle>
          <Typography variant="body2">
            <strong>{result.title}</strong> — ID: {result.id} | Género: {result.genre}
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
              {/* Title */}
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Título *"
                  value={form.title}
                  onChange={handleChange('title')}
                  placeholder="Ej: El Padrino"
                  required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Genre */}
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  select
                  label="Género *"
                  value={form.genre}
                  onChange={handleChange('genre')}
                  required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                >
                  {GENRES.map((g) => (
                    <MenuItem key={g} value={g}>{g}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              {/* Director */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Director *"
                  value={form.director}
                  onChange={handleChange('director')}
                  placeholder="Ej: Christopher Nolan"
                  required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Cast */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Reparto"
                  value={form.cast}
                  onChange={handleChange('cast')}
                  placeholder="Ej: Actor1, Actor2, Actor3"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Description */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Descripción"
                  value={form.description}
                  onChange={handleChange('description')}
                  placeholder="Sinopsis de la película..."
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Duration */}
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="Duración (min)"
                  value={form.durationMinutes}
                  onChange={handleChange('durationMinutes')}
                  inputProps={{ min: 1, max: 500 }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Year */}
              <Grid item xs={6} sm={2}>
                <TextField
                  fullWidth
                  type="number"
                  label="Año"
                  value={form.releaseYear}
                  onChange={handleChange('releaseYear')}
                  inputProps={{ min: 1900, max: 2100 }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Rating */}
              <Grid item xs={6} sm={2}>
                <TextField
                  fullWidth
                  select
                  label="Clasif."
                  value={form.rating}
                  onChange={handleChange('rating')}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                >
                  {RATINGS.map((r) => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              {/* IMDB Rating */}
              <Grid item xs={6} sm={2}>
                <TextField
                  fullWidth
                  type="number"
                  label="IMDB"
                  value={form.imdbRating}
                  onChange={handleChange('imdbRating')}
                  inputProps={{ min: 0, max: 10, step: 0.1 }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Price */}
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="Precio ($)"
                  value={form.price}
                  onChange={handleChange('price')}
                  inputProps={{ min: 0, step: 0.01 }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Poster URL */}
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="URL del Poster"
                  value={form.posterUrl}
                  onChange={handleChange('posterUrl')}
                  placeholder="https://ejemplo.com/poster.jpg (opcional)"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Featured */}
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  select
                  label="Destacado"
                  value={form.featured ? 'true' : 'false'}
                  onChange={(e) => setForm((prev) => ({ ...prev, featured: e.target.value === 'true' }))}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                >
                  <MenuItem value="false">No</MenuItem>
                  <MenuItem value="true">Sí</MenuItem>
                </TextField>
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
                startIcon={loading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <Add />}
                disabled={loading}
                sx={{ borderRadius: 2, px: 4 }}
              >
                {loading ? 'Creando...' : 'Crear Película'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Replication Status Hint */}
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
