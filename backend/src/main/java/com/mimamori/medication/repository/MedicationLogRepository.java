package com.mimamori.medication.repository;

import com.mimamori.medication.entity.MedicationLog;
import com.mimamori.medication.entity.MedicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MedicationLogRepository extends JpaRepository<MedicationLog, Long> {

    List<MedicationLog> findByElderlyIdOrderByScheduledTimeDesc(Long elderlyId);

    List<MedicationLog> findByElderlyIdAndScheduledTimeBetweenOrderByScheduledTimeAsc(
            Long elderlyId, LocalDateTime start, LocalDateTime end);

    List<MedicationLog> findByElderlyIdAndStatus(Long elderlyId, MedicationStatus status);

    Optional<MedicationLog> findByScheduleIdAndScheduledTime(Long scheduleId, LocalDateTime scheduledTime);

    @Query("SELECT COUNT(l) FROM MedicationLog l WHERE l.elderly.id = :elderlyId AND l.scheduledTime BETWEEN :start AND :end")
    long countTotalScheduled(@Param("elderlyId") Long elderlyId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COUNT(l) FROM MedicationLog l WHERE l.elderly.id = :elderlyId AND l.status = 'TAKEN' AND l.scheduledTime BETWEEN :start AND :end")
    long countTaken(@Param("elderlyId") Long elderlyId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}

