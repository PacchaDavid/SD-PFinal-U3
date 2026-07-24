package com.streaming.recomendaciones.controller;

import com.streaming.recomendaciones.dto.RecommendationResponse;
import com.streaming.recomendaciones.service.RecommendationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recomendaciones/recommendations")
public class RecommendationController {

    private final RecommendationService recommendationService;

    public RecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<RecommendationResponse>> getUserRecommendations(
            @PathVariable Long userId) {
        return ResponseEntity.ok(recommendationService.getUserRecommendations(userId));
    }

    @GetMapping("/user/{userId}/unwatched")
    public ResponseEntity<List<RecommendationResponse>> getUnwatched(
            @PathVariable Long userId) {
        return ResponseEntity.ok(recommendationService.getUnwatchedRecommendations(userId));
    }
}
