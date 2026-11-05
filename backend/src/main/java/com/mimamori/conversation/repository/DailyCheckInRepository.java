package com.mimamori.conversation.repository;

import com.mimamori.conversation.entity.DailyCheckIn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyCheckInRepository extends JpaRepository<DailyCheckIn, Long> {
    Optional<DailyCheckIn> findByElderlyIdAndCheckinDate(Long elderlyId, LocalDate checkinDate);
    List<DailyCheckIn> findByElderlyIdOrderByCheckinDateDesc(Long elderlyId);
    List<DailyCheckIn> findByElderlyIdAndCheckinDateBetweenOrderByCheckinDateAsc(Long elderlyId, LocalDate start, LocalDate end);
    boolean existsByElderlyIdAndCheckinDate(Long elderlyId, LocalDate checkinDate);
}

