package com.streaming.recomendaciones.repository;

import com.streaming.recomendaciones.model.Movie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MovieRepository extends JpaRepository<Movie, Long> {
    List<Movie> findByGenre(String genre);
    List<Movie> findByFeaturedTrue();
    List<Movie> findByReleaseYear(Integer year);
    List<Movie> findByGenreOrderByImdbRatingDesc(String genre);
}
