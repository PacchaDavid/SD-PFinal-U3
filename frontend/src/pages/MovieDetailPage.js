import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Chip, Grid, Card, CardMedia, Skeleton,
  IconButton, Paper,
} from '@mui/material';
import {
  PlayArrow, ArrowBack, AccessTime, Star, CalendarMonth,
  Category, InfoOutlined,
} from '@mui/icons-material';
import moviesService from '../services/moviesService';

export default function MovieDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await moviesService.getById(id);
        setMovie(data);
      } catch {
        navigate('/catalog');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3, mb: 3 }} />
        <Skeleton variant="text" width="60%" height={40} />
        <Skeleton variant="text" width="40%" height={24} />
        <Skeleton variant="text" width="80%" height={80} />
      </Box>
    );
  }

  if (!movie) return null;

  if (playing) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Box sx={{ maxWidth: 800, mx: 'auto', p: 4, borderRadius: 3, bgcolor: 'rgba(124,92,252,0.05)', border: '1px solid rgba(124,92,252,0.1)' }}>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
            ▶ {movie.title}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Reproducción iniciada — streaming simulado para demostración
          </Typography>
          <Button
            variant="outlined"
            onClick={() => setPlaying(false)}
            sx={{ mr: 2 }}
          >
            Detener
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/catalog')}
          >
            Volver al Catálogo
          </Button>
        </Box>
      </Box>
    );
  }

  const posterUrl = movie.posterUrl || '/boletos.svg';

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <IconButton onClick={() => navigate(-1)} sx={{ mb: 2, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
        <ArrowBack /> <Typography variant="body2" sx={{ ml: 1 }}>Volver</Typography>
      </IconButton>

      <Grid container spacing={4}>
        {/* Poster */}
        <Grid item xs={12} md={4}>
          <Card
            className="glow-primary"
            sx={{ borderRadius: 3, overflow: 'hidden', position: 'sticky', top: 88 }}
          >
            <CardMedia
              component="img"
              image={posterUrl}
              alt={movie.title}
              sx={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover' }}
            />
          </Card>
        </Grid>

        {/* Info */}
        <Grid item xs={12} md={8}>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Chip icon={<Star />} label={movie.rating || '4.5'} color="warning" size="small" sx={{ fontWeight: 600 }} />
              <Chip icon={<Category />} label={movie.genre || 'General'} size="small" variant="outlined" />
              <Chip icon={<AccessTime />} label={movie.duration || '120 min'} size="small" variant="outlined" />
              <Chip icon={<CalendarMonth />} label={movie.year || '2024'} size="small" variant="outlined" />
            </Box>

            <Typography variant="h3" fontWeight={800} sx={{ mb: 1, letterSpacing: '-0.02em' }}>
              {movie.title}
            </Typography>

            {movie.director && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Dirigida por <strong>{movie.director}</strong>
              </Typography>
            )}

            <Typography variant="body1" sx={{ mb: 4, lineHeight: 1.8, color: 'rgba(255,255,255,0.8)' }}>
              {movie.description || 'Sin descripción disponible.'}
            </Typography>

            {movie.cast && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Reparto
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {movie.cast.split(',').map((actor) => (
                    <Chip key={actor.trim()} label={actor.trim()} size="small" variant="outlined" sx={{ borderRadius: 2 }} />
                  ))}
                </Box>
              </Box>
            )}

            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={() => setPlaying(true)}
              sx={{
                px: 5, py: 1.5, fontSize: '1rem',
                borderRadius: 2,
                boxShadow: '0 4px 24px rgba(124,92,252,0.3)',
                '&:hover': { boxShadow: '0 6px 32px rgba(124,92,252,0.5)' },
              }}
            >
              Reproducir
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
