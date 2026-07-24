import React from 'react';
import { Card, CardMedia, CardContent, Typography, IconButton, Chip, Box } from '@mui/material';
import { PlayArrow } from '@mui/icons-material';

export default function MovieCard({ movie, onClick }) {
  const imgSeed = movie.id || Math.random().toString(36).slice(2);

  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        '&:hover': {
          '& .movie-img': { transform: 'scale(1.05)' },
          '& .movie-overlay': { opacity: 1 },
        },
      }}
    >
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <CardMedia
          component="img"
          className="movie-img"
          height={180}
          image={movie.posterUrl || `https://picsum.photos/seed/${imgSeed}/400/300`}
          alt={movie.title}
          sx={{ objectFit: 'cover', transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1)' }}
        />
        <Box
          className="movie-overlay"
          sx={{
            position: 'absolute', inset: 0,
            bgcolor: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.3s',
          }}
        >
          <IconButton sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'primary.main' } }}>
            <PlayArrow sx={{ color: 'white', fontSize: 32 }} />
          </IconButton>
        </Box>
      </Box>
      <CardContent sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={600} noWrap>
          {movie.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
          {movie.genre && (
            <Chip label={movie.genre} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }} />
          )}
          <Typography variant="caption" color="text.secondary">
            {movie.duration || '—'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
