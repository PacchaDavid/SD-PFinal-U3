package com.streaming.recomendaciones.controller;

import com.streaming.recomendaciones.dto.MovieResponse;
import com.streaming.recomendaciones.service.MovieService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/recomendaciones")
public class MovieController {

    private final MovieService movieService;

    public MovieController(MovieService movieService) {
        this.movieService = movieService;
    }

    @GetMapping
    public ResponseEntity<List<MovieResponse>> getAllMovies() {
        return ResponseEntity.ok(movieService.getAllMovies());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getMovie(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(movieService.getMovieById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/genre/{genre}")
    public ResponseEntity<List<MovieResponse>> getByGenre(@PathVariable String genre) {
        return ResponseEntity.ok(movieService.getMoviesByGenre(genre));
    }

    @GetMapping("/featured")
    public ResponseEntity<List<MovieResponse>> getFeatured() {
        return ResponseEntity.ok(movieService.getFeaturedMovies());
    }

    @GetMapping("/search")
    public ResponseEntity<List<MovieResponse>> search(@RequestParam String q) {
        return ResponseEntity.ok(movieService.searchMovies(q));
    }

    @GetMapping("/count")
    public ResponseEntity<Map<String, Long>> getCount() {
        return ResponseEntity.ok(Map.of("count", movieService.getMovieCount()));
    }
}
