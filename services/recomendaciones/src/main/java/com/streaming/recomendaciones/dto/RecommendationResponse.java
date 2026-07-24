package com.streaming.recomendaciones.dto;

import com.streaming.recomendaciones.model.Recommendation;

public class RecommendationResponse {
    private Long id;
    private MovieResponse movie;
    private Double score;
    private String reason;
    private Boolean watched;

    public static RecommendationResponse fromEntity(Recommendation rec) {
        RecommendationResponse dto = new RecommendationResponse();
        dto.setId(rec.getId());
        dto.setMovie(MovieResponse.fromEntity(rec.getMovie()));
        dto.setScore(rec.getScore());
        dto.setReason(rec.getReason());
        dto.setWatched(rec.getWatched());
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public MovieResponse getMovie() { return movie; }
    public void setMovie(MovieResponse movie) { this.movie = movie; }

    public Double getScore() { return score; }
    public void setScore(Double score) { this.score = score; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public Boolean getWatched() { return watched; }
    public void setWatched(Boolean watched) { this.watched = watched; }
}
