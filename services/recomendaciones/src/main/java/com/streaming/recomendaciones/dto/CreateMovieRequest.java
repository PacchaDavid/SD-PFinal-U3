package com.streaming.recomendaciones.dto;

import com.streaming.recomendaciones.model.Movie;
import java.math.BigDecimal;

/**
 * DTO para crear una nueva película desde el panel de administración.
 * Los campos requeridos son title, genre y director.
 */
public class CreateMovieRequest {

    private String title;
    private String description;
    private String posterUrl;
    private String backdropUrl;
    private String genre;
    private Integer durationMinutes;
    private Integer releaseYear;
    private String rating = "PG-13";
    private Double imdbRating;
    private String director;
    private String cast;
    private BigDecimal price = BigDecimal.ZERO;
    private Boolean featured = false;

    public Movie toEntity() {
        Movie movie = new Movie();
        movie.setTitle(this.title);
        movie.setDescription(this.description);
        movie.setPosterUrl(this.posterUrl);
        movie.setBackdropUrl(this.backdropUrl);
        movie.setGenre(this.genre);
        movie.setDurationMinutes(this.durationMinutes);
        movie.setReleaseYear(this.releaseYear);
        movie.setRating(this.rating);
        movie.setImdbRating(this.imdbRating);
        movie.setDirector(this.director);
        movie.setCast(this.cast);
        movie.setPrice(this.price);
        movie.setFeatured(this.featured);
        return movie;
    }

    // --- Getters y Setters ---

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
