package com.streaming.recomendaciones.service;

import com.streaming.recomendaciones.dto.RecommendationResponse;
import com.streaming.recomendaciones.model.Movie;
import com.streaming.recomendaciones.model.Recommendation;
import com.streaming.recomendaciones.repository.MovieRepository;
import com.streaming.recomendaciones.repository.RecommendationRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

@Service
public class RecommendationService {

    private final RecommendationRepository recommendationRepository;
    private final MovieRepository movieRepository;
    private final Random random;

    public RecommendationService(RecommendationRepository recommendationRepository,
                                  MovieRepository movieRepository) {
        this.recommendationRepository = recommendationRepository;
        this.movieRepository = movieRepository;
        this.random = new Random();
    }

    public List<RecommendationResponse> getUserRecommendations(Long userId) {
        List<Recommendation> recs = recommendationRepository
                .findByUserIdOrderByScoreDesc(userId);

        if (!recs.isEmpty()) {
            return recs.stream()
                    .map(RecommendationResponse::fromEntity)
                    .collect(Collectors.toList());
        }

        // Generar recomendaciones automáticas si no existen
        return generateRecommendations(userId);
    }

    public List<RecommendationResponse> getUnwatchedRecommendations(Long userId) {
        return recommendationRepository
                .findByUserIdAndWatchedFalseOrderByScoreDesc(userId)
                .stream()
                .map(RecommendationResponse::fromEntity)
                .collect(Collectors.toList());
    }

    private List<RecommendationResponse> generateRecommendations(Long userId) {
        List<Movie> allMovies = movieRepository.findAll();
        if (allMovies.isEmpty()) {
            return List.of();
        }

        // Tomar hasta 6 películas aleatorias como recomendaciones
        int count = Math.min(6, allMovies.size());
        List<Movie> selected = new java.util.ArrayList<>(allMovies);
        java.util.Collections.shuffle(selected, random);
        selected = selected.subList(0, count);

        List<Recommendation> recommendations = selected.stream().map(movie -> {
            Recommendation rec = new Recommendation();
            rec.setUserId(userId);
            rec.setMovie(movie);
            rec.setScore(50.0 + random.nextDouble() * 50.0);
            rec.setReason(getRandomReason(movie.getGenre()));
            rec.setWatched(false);
            return recommendationRepository.save(rec);
        }).collect(Collectors.toList());

        return recommendations.stream()
                .map(RecommendationResponse::fromEntity)
                .collect(Collectors.toList());
    }

    private String getRandomReason(String genre) {
        String[] reasons = {
            "Porque viste películas similares",
            "Basado en tus géneros favoritos",
            "Tendencia en " + (genre != null ? genre : "este mes"),
            "Recomendado por la comunidad",
            "Porque te gustó " + (genre != null ? genre : "este género"),
            "Nuevo lanzamiento que podría interesarte",
        };
        return reasons[random.nextInt(reasons.length)];
    }
}
