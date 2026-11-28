package com.mimamori.routine.repository;

import com.mimamori.routine.entity.CareRoutineLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface CareRoutineLogRepository extends JpaRepository<CareRoutineLog, Long> {
    List<CareRoutineLog> findByElderlyIdAndRoutineDateOrderByScheduledTimeAsc(Long elderlyId, LocalDate routineDate);

    Optional<CareRoutineLog> findByElderlyIdAndRoutineDateAndRoutineTypeAndScheduledTime(
            Long elderlyId, LocalDate routineDate, String routineType, String scheduledTime);
}
