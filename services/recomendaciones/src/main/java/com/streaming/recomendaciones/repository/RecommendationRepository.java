package com.streaming.recomendaciones.repository;

import com.streaming.recomendaciones.model.Recommendation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RecommendationRepository extends JpaRepository<Recommendation, Long> {
    List<Recommendation> findByUserIdOrderByScoreDesc(Long userId);
    List<Recommendation> findByUserIdAndWatchedFalseOrderByScoreDesc(Long userId);
}
