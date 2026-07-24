package com.streaming.recomendaciones.dto;

import com.streaming.recomendaciones.model.Movie;
import java.math.BigDecimal;

public class MovieResponse {
    private Long id;
    private String title;
    private String description;
    private String posterUrl;
    private String backdropUrl;
    private String genre;
    private Integer durationMinutes;
    private Integer releaseYear;
    private String rating;
    private Double imdbRating;
    private String director;
    private String cast;
    private BigDecimal price;
    private Boolean featured;

    public static MovieResponse fromEntity(Movie movie) {
        MovieResponse dto = new MovieResponse();
        dto.setId(movie.getId());
        dto.setTitle(movie.getTitle());
        dto.setDescription(movie.getDescription());
        dto.setPosterUrl(movie.getPosterUrl());
        dto.setBackdropUrl(movie.getBackdropUrl());
        dto.setGenre(movie.getGenre());
        dto.setDurationMinutes(movie.getDurationMinutes());
        dto.setReleaseYear(movie.getReleaseYear());
        dto.setRating(movie.getRating());
        dto.setImdbRating(movie.getImdbRating());
        dto.setDirector(movie.getDirector());
        dto.setCast(movie.getCast());
        dto.setPrice(movie.getPrice());
        dto.setFeatured(movie.getFeatured());
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getPosterUrl() { return posterUrl; }
    public void setPosterUrl(String posterUrl) { this.posterUrl = posterUrl; }

    public String getBackdropUrl() { return backdropUrl; }
    public void setBackdropUrl(String backdropUrl) { this.backdropUrl = backdropUrl; }

    public String getGenre() { return genre; }
    public void setGenre(String genre) { this.genre = genre; }

    public Integer getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }

    public Integer getReleaseYear() { return releaseYear; }
    public void setReleaseYear(Integer releaseYear) { this.releaseYear = releaseYear; }

    public String getRating() { return rating; }
    public void setRating(String rating) { this.rating = rating; }

    public Double getImdbRating() { return imdbRating; }
    public void setImdbRating(Double imdbRating) { this.imdbRating = imdbRating; }

    public String getDirector() { return director; }
    public void setDirector(String director) { this.director = director; }

    public String getCast() { return cast; }
    public void setCast(String cast) { this.cast = cast; }

    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }

    public Boolean getFeatured() { return featured; }
    public void setFeatured(Boolean featured) { this.featured = featured; }
}
