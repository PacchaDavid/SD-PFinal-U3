import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardMedia, CardContent, Chip, Grid,
  Skeleton, IconButton,
} from '@mui/material';
import {
  PlayArrow, InfoOutlined, TrendingUp, MovieCreation,
  Whatshot, ArrowForward,
} from '@mui/icons-material';
import moviesService from '../services/moviesService';
import { useAuth } from '../context/AuthContext';
import MovieCard from '../components/Catalog/MovieCard';

const FEATURED_GENRES = ['Acción', 'Drama', 'Comedia', 'Terror'];

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [featured, setFeatured] = useState([]);
  const [byGenre, setByGenre] = useState({});
  const [loading, setLoading] = useState(true);
  const [heroMovie, setHeroMovie] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const feat = await moviesService.getFeatured();
        setFeatured(feat);
        if (feat.length > 0) setHeroMovie(feat[0]);

        const genreResults = {};
        for (const genre of FEATURED_GENRES) {
          const movies = await moviesService.getByGenre(genre);
          if (movies.length > 0) genreResults[genre] = movies;
        }
        setByGenre(genreResults);
      } catch {
        // Use empty state
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (!isAuthenticated) {
    return (
      <Box sx={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', py: 8, px: 2 }}>
        <Typography variant="h3" fontWeight={800} sx={{ mb: 2, background: 'linear-gradient(135deg, #f1f1f6, #7c5cfc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Bienvenido a StreamHub
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mb: 4 }}>
          Explora nuestro catálogo de películas, recibe recomendaciones personalizadas y gestiona tu cuenta.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button variant="contained" size="large" onClick={() => navigate('/login')} sx={{ px: 4, py: 1.5 }}>
            Iniciar Sesión
          </Button>
          <Button variant="outlined" size="large" onClick={() => navigate('/register')} sx={{ px: 4, py: 1.5 }}>
            Registrarse
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {/* Hero Section */}
      {loading ? (
        <Skeleton variant="rounded" height={320} sx={{ borderRadius: 3, mb: 4 }} />
      ) : heroMovie ? (
        <Card
          className="glow-primary"
          sx={{
            position: 'relative',
            height: { xs: 280, md: 360 },
            borderRadius: 3,
            mb: 4,
            overflow: 'hidden',
            cursor: 'pointer',
            '&:hover .hero-overlay': { opacity: 1 },
          }}
          onClick={() => navigate(`/catalog/${heroMovie.id}`)}
        >
          <CardMedia
            component="img"
            height="100%"
            image={heroMovie.posterUrl || `https://picsum.photos/seed/${heroMovie.id}/1200/600`}
            alt={heroMovie.title}
            sx={{ objectFit: 'cover' }}
          />
          <Box
            className="hero-overlay"
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.3) 50%, transparent 100%)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              p: { xs: 3, md: 5 },
              transition: 'opacity 0.3s',
            }}
          >
            <Chip
              label="Destacado"
              size="small"
              icon={<Whatshot sx={{ fontSize: 14 }} />}
              sx={{
                alignSelf: 'flex-start',
                mb: 1.5,
                bgcolor: 'rgba(124,92,252,0.2)',
                color: 'primary.light',
                fontWeight: 600,
                fontSize: '0.7rem',
              }}
            />
            <Typography variant="h3" fontWeight={800} sx={{ mb: 0.5, textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
              {heroMovie.title}
            </Typography>
            <Typography variant="body1" color="rgba(255,255,255,0.7)" sx={{ mb: 2, maxWidth: 600 }}>
              {heroMovie.description}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button variant="contained" startIcon={<PlayArrow />} sx={{ borderRadius: 2 }}>
                Reproducir
              </Button>
              <Button variant="outlined" startIcon={<InfoOutlined />} sx={{ borderRadius: 2, color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}>
                Más Info
              </Button>
            </Box>
          </Box>
        </Card>
      ) : null}

      {/* Featured Row */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5" fontWeight={700}>
            <TrendingUp sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }} />
            Recomendados
          </Typography>
          <Button endIcon={<ArrowForward />} onClick={() => navigate('/catalog')} size="small" sx={{ color: 'text.secondary' }}>
            Ver Todos
          </Button>
        </Box>
        <Grid container spacing={2}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Grid item xs={6} sm={4} md={3} key={i}>
                  <Skeleton variant="rounded" height={200} sx={{ borderRadius: 2 }} />
                </Grid>
              ))
            : featured.slice(0, 4).map((movie) => (
                <Grid item xs={6} sm={4} md={3} key={movie.id}>
                  <MovieCard movie={movie} onClick={() => navigate(`/catalog/${movie.id}`)} />
                </Grid>
              ))
          }
        </Grid>
      </Box>

      {/* Genre Rows */}
      {Object.entries(byGenre).map(([genre, movies]) => (
        <Box key={genre} sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              <MovieCreation sx={{ verticalAlign: 'middle', mr: 1, fontSize: 20, color: 'secondary.main' }} />
              {genre}
            </Typography>
            <Button endIcon={<ArrowForward />} onClick={() => navigate(`/catalog?genre=${encodeURIComponent(genre)}`)} size="small" sx={{ color: 'text.secondary' }}>
              Ver Más
            </Button>
          </Box>
          <Grid container spacing={2}>
            {movies.slice(0, 4).map((movie) => (
              <Grid item xs={6} sm={4} md={3} key={movie.id}>
                <MovieCard movie={movie} onClick={() => navigate(`/catalog/${movie.id}`)} />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
}
