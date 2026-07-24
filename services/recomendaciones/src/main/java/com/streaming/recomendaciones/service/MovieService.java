package com.streaming.recomendaciones.service;

import com.streaming.recomendaciones.dto.MovieResponse;
import com.streaming.recomendaciones.model.Movie;
import com.streaming.recomendaciones.repository.MovieRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class MovieService {

    private final MovieRepository movieRepository;

    public MovieService(MovieRepository movieRepository) {
        this.movieRepository = movieRepository;
    }

    public List<MovieResponse> getAllMovies() {
        return movieRepository.findAll().stream()
                .map(MovieResponse::fromEntity)
                .collect(Collectors.toList());
    }

    public MovieResponse getMovieById(Long id) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Película no encontrada"));
        return MovieResponse.fromEntity(movie);
    }

    public List<MovieResponse> getMoviesByGenre(String genre) {
        return movieRepository.findByGenre(genre).stream()
                .map(MovieResponse::fromEntity)
                .collect(Collectors.toList());
    }

    public List<MovieResponse> getFeaturedMovies() {
        return movieRepository.findByFeaturedTrue().stream()
                .map(MovieResponse::fromEntity)
                .collect(Collectors.toList());
    }

    public List<MovieResponse> searchMovies(String query) {
        return movieRepository.findAll().stream()
                .filter(m -> m.getTitle().toLowerCase().contains(query.toLowerCase())
                        || m.getGenre().toLowerCase().contains(query.toLowerCase())
                        || (m.getDirector() != null && m.getDirector().toLowerCase().contains(query.toLowerCase())))
                .map(MovieResponse::fromEntity)
                .collect(Collectors.toList());
    }

    public long getMovieCount() {
        return movieRepository.count();
    }
}
