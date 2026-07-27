import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Card, CardMedia, CardContent, Chip, Skeleton,
  IconButton, Alert, AlertTitle,
} from '@mui/material';
import {
  Whatshot, TrendingUp, PlayArrow, MovieCreation, Warning as WarningIcon,
} from '@mui/icons-material';
import moviesService from '../services/moviesService';
import { useAuth } from '../context/AuthContext';

export default function RecommendationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fallbackActive, setFallbackActive] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let recFallback = false;
      let featFallback = false;

      try {
        if (user?.id) {
          const recs = await moviesService.getRecommendations(user.id);
          if (Array.isArray(recs)) {
            setRecommendations(recs);
          } else {
            setRecommendations(Array.isArray(recs.items) ? recs.items : []);
            if (recs.cb_fallback) recFallback = true;
          }
        }
        const feat = await moviesService.getFeatured();
        if (Array.isArray(feat)) {
          setTrending(feat.slice(0, 4));
        } else {
          setTrending(Array.isArray(feat.items) ? feat.items.slice(0, 4) : []);
          if (feat.cb_fallback) featFallback = true;
        }
      } catch {
        setRecommendations([]);
      } finally {
        setFallbackActive(recFallback || featFallback);
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const renderMovieGrid = (movies, emptyMsg) => {
    if (movies.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <MovieCreation sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">{emptyMsg}</Typography>
        </Box>
      );
    }
    return (
      <Grid container spacing={2.5}>
        {movies.map((movie, i) => (
          <Grid item xs={6} sm={4} md={3} key={movie.id}>
            <Card
              onClick={() => navigate(`/catalog/${movie.id}`)}
              sx={{
                borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
                animation: `fade-up 0.4s ease both`,
                animationDelay: `${i * 60}ms`,
                '&:hover .play-overlay': { opacity: 1 },
                '&:hover .movie-img': { transform: 'scale(1.08)' },
              }}
            >
              <Box sx={{ position: 'relative', overflow: 'hidden', pt: '140%' }}>
                <CardMedia
                  component="img"
                  className="movie-img"
                  image={movie.posterUrl || '/boletos.svg'}
                  alt={movie.title}
                  sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }}
                />
                <Box className="play-overlay" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.3s' }}>
                  <IconButton sx={{ bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'primary.main' } }}>
                    <PlayArrow sx={{ color: 'white', fontSize: 32 }} />
                  </IconButton>
                </Box>
              </Box>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={600} noWrap>{movie.title}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
                  <Chip label={movie.genre || 'General'} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }} />
                  {movie.year && (
                    <Typography variant="caption" color="text.secondary">{movie.year}</Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      {/* CB Fallback Banner */}
      {fallbackActive && (
        <Alert
          severity="warning"
          icon={<WarningIcon />}
          sx={{ mb: 3, borderRadius: 2, bgcolor: 'rgba(237,173,18,0.08)', border: '1px solid', borderColor: 'warning.main' }}
        >
          <AlertTitle sx={{ fontWeight: 700, mb: 0.5 }}>
            Servicio de recomendaciones temporalmente no disponible
          </AlertTitle>
          <Typography variant="body2">
            El sistema de recomendaciones personalizadas está en mantenimiento.
            Mostrando catálogo genérico mientras tanto. Puedes seguir explorando películas.
          </Typography>
        </Alert>
      )}

      {/* Trending */}
      <Box sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <Whatshot sx={{ color: 'warning.main', fontSize: 28 }} />
          <Typography variant="h5" fontWeight={700}>Tendencias</Typography>
        </Box>
        {loading ? (
          <Grid container spacing={2}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Grid item xs={6} sm={4} md={3} key={i}>
                <Skeleton variant="rounded" height={280} sx={{ borderRadius: 2 }} />
              </Grid>
            ))}
          </Grid>
        ) : renderMovieGrid(trending, 'No hay tendencias disponibles')}
      </Box>

      {/* Recommendations */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <TrendingUp sx={{ color: 'primary.main', fontSize: 28 }} />
          <Typography variant="h5" fontWeight={700}>
            {fallbackActive ? 'Top 10 Populares' : 'Recomendaciones para ti'}
          </Typography>
        </Box>
        {loading ? (
          <Grid container spacing={2}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Grid item xs={6} sm={4} md={3} key={i}>
                <Skeleton variant="rounded" height={280} sx={{ borderRadius: 2 }} />
              </Grid>
            ))}
          </Grid>
        ) : renderMovieGrid(recommendations, fallbackActive ? 'No hay películas disponibles en este momento.' : 'Aún no tenemos recomendaciones personalizadas. Explora el catálogo para ayudarnos a conocerte mejor.')}
      </Box>
    </Box>
  );
}
