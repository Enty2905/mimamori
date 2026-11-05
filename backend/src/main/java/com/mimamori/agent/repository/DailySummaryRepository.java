package com.mimamori.agent.repository;

import com.mimamori.agent.entity.DailySummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailySummaryRepository extends JpaRepository<DailySummary, Long> {
    Optional<DailySummary> findByElderlyIdAndSummaryDate(Long elderlyId, LocalDate summaryDate);
    List<DailySummary> findByElderlyIdOrderBySummaryDateDesc(Long elderlyId);
}

