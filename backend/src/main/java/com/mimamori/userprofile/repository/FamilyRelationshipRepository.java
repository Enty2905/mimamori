package com.mimamori.userprofile.repository;

import com.mimamori.userprofile.entity.FamilyRelationship;
import com.mimamori.userprofile.entity.RelationshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FamilyRelationshipRepository extends JpaRepository<FamilyRelationship, Long> {
    
    List<FamilyRelationship> findByCaregiverId(Long caregiverId);
    
    List<FamilyRelationship> findByElderlyId(Long elderlyId);

    Optional<FamilyRelationship> findByCaregiverIdAndElderlyId(Long caregiverId, Long elderlyId);

    @Query("SELECT r FROM FamilyRelationship r WHERE (r.caregiver.id = :userId OR r.elderly.id = :userId) AND r.status = :status")
    List<FamilyRelationship> findAllActiveForUser(@Param("userId") Long userId, @Param("status") RelationshipStatus status);

    @Query("SELECT COUNT(r) > 0 FROM FamilyRelationship r WHERE r.caregiver.id = :caregiverId AND r.elderly.id = :elderlyId AND r.status = com.mimamori.userprofile.entity.RelationshipStatus.ACCEPTED")
    boolean existsByCaregiverIdAndElderlyId(@Param("caregiverId") Long caregiverId, @Param("elderlyId") Long elderlyId);
}

