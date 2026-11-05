package com.mimamori.medication.repository;

import com.mimamori.medication.entity.Medication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MedicationRepository extends JpaRepository<Medication, Long> {
    List<Medication> findByElderlyIdAndIsActiveTrue(Long elderlyId);
    List<Medication> findByElderlyId(Long elderlyId);
}

