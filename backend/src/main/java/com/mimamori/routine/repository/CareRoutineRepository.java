package com.mimamori.routine.repository;

import com.mimamori.routine.entity.CareRoutine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CareRoutineRepository extends JpaRepository<CareRoutine, Long> {
    Optional<CareRoutine> findByElderlyId(Long elderlyId);
}
