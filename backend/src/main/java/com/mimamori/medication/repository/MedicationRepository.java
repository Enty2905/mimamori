package com.mimamori.medication.repository;

import com.mimamori.medication.entity.Medication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MedicationRepository extends JpaRepository<Medication, Long> {
    List<Medication> findByIsActiveTrue();
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT m FROM Medication m WHERE m.id=:id")
    java.util.Optional<Medication> findLockedById(@org.springframework.data.repository.query.Param("id") Long id);
    List<Medication> findByElderlyIdAndIsActiveTrue(Long elderlyId);
    List<Medication> findByElderlyId(Long elderlyId);
}

