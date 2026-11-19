package com.mimamori.health.service;

import com.mimamori.common.ApiException;
import com.mimamori.health.dto.CreateHealthConditionRequest;
import com.mimamori.health.dto.HealthConditionDto;
import com.mimamori.health.entity.HealthCondition;
import com.mimamori.health.repository.HealthConditionRepository;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.entity.UserRole;
import com.mimamori.userprofile.repository.FamilyRelationshipRepository;
import com.mimamori.userprofile.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
public class HealthConditionService {

    private static final Set<String> VALID_STATUSES = Set.of("STABLE", "MONITORING", "WORSENING", "RECOVERED");
    private static final Set<String> VALID_SEVERITIES = Set.of("MILD", "MODERATE", "SEVERE");

    private final HealthConditionRepository conditionRepository;
    private final UserRepository userRepository;
    private final FamilyRelationshipRepository relationshipRepository;

    public HealthConditionService(
            HealthConditionRepository conditionRepository,
            UserRepository userRepository,
            FamilyRelationshipRepository relationshipRepository) {
        this.conditionRepository = conditionRepository;
        this.userRepository = userRepository;
        this.relationshipRepository = relationshipRepository;
    }

    public List<HealthConditionDto> getConditions(Long currentUserId, Long targetElderlyId) {
        Long elderlyId = resolveElderlyId(currentUserId, targetElderlyId);
        return conditionRepository.findByElderlyIdOrderByRecordDateDescCreatedAtDesc(elderlyId)
                .stream()
                .map(HealthConditionDto::fromEntity)
                .collect(Collectors.toList());
    }

    public HealthConditionDto createCondition(Long currentUserId, CreateHealthConditionRequest request) {
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ApiException(404, "User not found"));

        User targetElderly = resolveTargetElderly(currentUser, request.getElderlyId());

        HealthCondition entity = new HealthCondition();
        entity.setElderly(targetElderly);
        entity.setCreatedBy(currentUser);
        applyRequestFields(entity, request);

        entity = conditionRepository.save(entity);
        return HealthConditionDto.fromEntity(entity);
    }

    public HealthConditionDto updateCondition(Long currentUserId, Long conditionId, CreateHealthConditionRequest request) {
        HealthCondition entity = conditionRepository.findById(conditionId)
                .orElseThrow(() -> new ApiException(404, "Health condition record not found"));

        Long elderlyId = entity.getElderly().getId();
        if (!elderlyId.equals(currentUserId) && !relationshipRepository.existsByCaregiverIdAndElderlyId(currentUserId, elderlyId)) {
            throw new ApiException(403, "You do not have permission to update this health condition");
        }

        applyRequestFields(entity, request);
        entity = conditionRepository.save(entity);
        return HealthConditionDto.fromEntity(entity);
    }

    public void deleteCondition(Long currentUserId, Long conditionId) {
        HealthCondition entity = conditionRepository.findById(conditionId)
                .orElseThrow(() -> new ApiException(404, "Health condition record not found"));

        Long elderlyId = entity.getElderly().getId();
        if (!elderlyId.equals(currentUserId) && !relationshipRepository.existsByCaregiverIdAndElderlyId(currentUserId, elderlyId)) {
            throw new ApiException(403, "You do not have permission to delete this health condition");
        }

        conditionRepository.delete(entity);
    }

    private void applyRequestFields(HealthCondition entity, CreateHealthConditionRequest request) {
        entity.setConditionName(request.getConditionName().trim());
        String status = request.getStatus() != null ? request.getStatus().trim().toUpperCase() : "MONITORING";
        entity.setStatus(VALID_STATUSES.contains(status) ? status : "MONITORING");

        String severity = request.getSeverity() != null ? request.getSeverity().trim().toUpperCase() : "MODERATE";
        entity.setSeverity(VALID_SEVERITIES.contains(severity) ? severity : "MODERATE");

        entity.setRecordDate(request.getRecordDate() != null ? request.getRecordDate() : LocalDate.now());
        entity.setNextCheckupDate(request.getNextCheckupDate());
        entity.setDoctorOrClinic(trimOrNull(request.getDoctorOrClinic()));
        entity.setSymptomsOrNotes(trimOrNull(request.getSymptomsOrNotes()));
    }

    private String trimOrNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private User resolveTargetElderly(User currentUser, Long targetElderlyId) {
        if (currentUser.getRole() == UserRole.ELDERLY) {
            return currentUser;
        }
        if (targetElderlyId == null) {
            throw new ApiException(400, "Elderly ID is required when recording health condition as a caregiver");
        }
        if (!relationshipRepository.existsByCaregiverIdAndElderlyId(currentUser.getId(), targetElderlyId)) {
            throw new ApiException(403, "You do not have permission to manage health records for this elderly user");
        }
        return userRepository.findById(targetElderlyId)
                .orElseThrow(() -> new ApiException(404, "Target elderly user not found"));
    }

    private Long resolveElderlyId(Long currentUserId, Long targetElderlyId) {
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ApiException(404, "User not found"));
        if (currentUser.getRole() == UserRole.ELDERLY) {
            return currentUserId;
        }
        if (targetElderlyId != null) {
            if (!relationshipRepository.existsByCaregiverIdAndElderlyId(currentUserId, targetElderlyId)) {
                throw new ApiException(403, "You are not authorized to view this elderly member's health records");
            }
            return targetElderlyId;
        }
        return relationshipRepository.findByCaregiverId(currentUserId)
                .stream()
                .findFirst()
                .map(rel -> rel.getElderly().getId())
                .orElse(currentUserId);
    }
}
