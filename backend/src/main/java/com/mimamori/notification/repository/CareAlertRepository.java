package com.mimamori.notification.repository;

import com.mimamori.notification.entity.CareAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CareAlertRepository extends JpaRepository<CareAlert, Long> {
    List<CareAlert> findByElderlyIdOrderByCreatedAtDesc(Long elderlyId);
    List<CareAlert> findByCaregiverIdOrderByCreatedAtDesc(Long caregiverId);
    List<CareAlert> findByCaregiverIdAndIsReadFalse(Long caregiverId);
    List<CareAlert> findByElderlyIdAndIsResolvedFalse(Long elderlyId);
    long countByCaregiverIdAndIsReadFalse(Long caregiverId);
}

