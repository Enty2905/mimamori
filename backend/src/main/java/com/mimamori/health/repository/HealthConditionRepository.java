package com.mimamori.health.repository;

import com.mimamori.health.entity.HealthCondition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HealthConditionRepository extends JpaRepository<HealthCondition, Long> {

    List<HealthCondition> findByElderlyIdOrderByRecordDateDescCreatedAtDesc(Long elderlyId);
}
