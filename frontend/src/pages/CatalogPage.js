import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Grid, Card, CardMedia, CardContent, Chip, TextField,
  InputAdornment, Skeleton, Container, FormControl, InputLabel, Select,
  MenuItem, Button, Slider, IconButton,
} from '@mui/material';
import {
  Search, MovieCreation, FilterList, Clear, PlayArrow,
} from '@mui/icons-material';
import moviesService from '../services/moviesService';

const GENRES = [
  'Acción', 'Aventura', 'Comedia', 'Drama', 'Terror',
  'Ciencia Ficción', 'Romance', 'Suspenso', 'Animación', 'Documental',
];

export default function CatalogPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialGenre = searchParams.get('genre') || '';
  const initialQuery = searchParams.get('q') || '';

  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialQuery);
  const [selectedGenre, setSelectedGenre] = useState(initialGenre);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let results;
        if (search) {
          results = await moviesService.search(search);
        } else if (selectedGenre) {
          results = await moviesService.getByGenre(selectedGenre);
        } else {
          results = await moviesService.getAll();
        }
        setMovies(Array.isArray(results) ? results : []);
      } catch {
        setMovies([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [search, selectedGenre]);

  const handleSearch = (e) => {
    e.preventDefault();
    // Already filtered via useEffect
  };

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
            Catálogo
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {loading ? 'Cargando...' : `${movies.length} películas disponibles`}
          </Typography>
        </Box>
        <IconButton onClick={() => setShowFilters(!showFilters)} sx={{ color: showFilters ? 'primary.main' : 'text.secondary' }}>
          <FilterList />
        </IconButton>
      </Box>

      {/* Search + Filters */}
      <Box component="form" onSubmit={handleSearch} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Buscar por título, género..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.disabled' }} /></InputAdornment>,
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')}><Clear fontSize="small" /></IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.04)',
              borderRadius: 2,
              '& fieldset': { borderColor: 'rgba(255,255,255,0.06)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
              '&.Mui-focused fieldset': { borderColor: 'primary.main' },
            },
          }}
        />
      </Box>

      {/* Genre Chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        <Chip
          label="Todas"
          onClick={() => setSelectedGenre('')}
          variant={selectedGenre === '' ? 'filled' : 'outlined'}
          color={selectedGenre === '' ? 'primary' : 'default'}
          sx={{ fontWeight: 600, borderRadius: 2 }}
        />
        {GENRES.map((genre) => (
          <Chip
            key={genre}
            label={genre}
            onClick={() => setSelectedGenre(genre === selectedGenre ? '' : genre)}
            variant={selectedGenre === genre ? 'filled' : 'outlined'}
            color={selectedGenre === genre ? 'primary' : 'default'}
            sx={{ fontWeight: 500, borderRadius: 2, '&:hover': { bgcolor: selectedGenre === genre ? undefined : 'rgba(255,255,255,0.05)' } }}
          />
        ))}
      </Box>

      {/* Movie Grid */}
      <Grid container spacing={2.5}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Grid item xs={6} sm={4} md={3} lg={2.4} key={i}>
                <Skeleton variant="rounded" height={280} sx={{ borderRadius: 2 }} />
              </Grid>
            ))
          : movies.length === 0 ? (
              <Grid item xs={12}>
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <MovieCreation sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">No se encontraron películas</Typography>
                  <Typography variant="body2" color="text.disabled">
                    Intenta con otra búsqueda o filtro
                  </Typography>
                </Box>
              </Grid>
            ) : (
              movies.map((movie, index) => (
                <Grid item xs={6} sm={4} md={3} lg={2.4} key={movie.id}>
                  <Card
                    onClick={() => navigate(`/catalog/${movie.id}`)}
                    sx={{
                      borderRadius: 2,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      animation: `fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both`,
                      animationDelay: `${(index % 8) * 60}ms`,
                      '&:hover .play-overlay': { opacity: 1 },
                      '&:hover .movie-img': { transform: 'scale(1.08)' },
                    }}
                  >
                    <Box sx={{ position: 'relative', overflow: 'hidden', pt: '140%' }}>
                      <CardMedia
                        component="img"
                        className="movie-img"
                        image={movie.posterUrl || `https://picsum.photos/seed/movie${movie.id}/400/560`}
                        alt={movie.title}
                        sx={{
                          position: 'absolute', top: 0, left: 0,
                          width: '100%', height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1)',
                        }}
                      />
                      <Box
                        className="play-overlay"
                        sx={{
                          position: 'absolute', inset: 0,
                          bgcolor: 'rgba(0,0,0,0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: 0, transition: 'opacity 0.3s',
                        }}
                      >
                        <IconButton sx={{ bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'primary.main', transform: 'scale(1.1)' } }}>
                          <PlayArrow sx={{ color: 'white', fontSize: 36 }} />
                        </IconButton>
                      </Box>
                    </Box>
                    <CardContent sx={{ p: 1.5, flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600} noWrap>
                        {movie.title}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Chip label={movie.genre} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }} />
                        <Typography variant="caption" color="text.secondary">{movie.duration || ''}</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))
            )
        }
      </Grid>
    </Box>
  );
}
