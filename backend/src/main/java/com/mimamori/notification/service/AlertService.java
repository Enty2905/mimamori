package com.mimamori.notification.service;

import com.mimamori.common.ApiException;
import com.mimamori.notification.dto.CareAlertDto;
import com.mimamori.notification.entity.AlertSeverity;
import com.mimamori.notification.entity.AlertType;
import com.mimamori.notification.entity.CareAlert;
import com.mimamori.notification.repository.CareAlertRepository;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.entity.UserRole;
import com.mimamori.userprofile.repository.FamilyRelationshipRepository;
import com.mimamori.userprofile.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class AlertService {

    private final CareAlertRepository alertRepository;
    private final UserRepository userRepository;
    private final FamilyRelationshipRepository relationshipRepository;
    private final NotificationService notificationService;

    public AlertService(
            CareAlertRepository alertRepository,
            UserRepository userRepository,
            FamilyRelationshipRepository relationshipRepository,
            NotificationService notificationService) {
        this.alertRepository = alertRepository;
        this.userRepository = userRepository;
        this.relationshipRepository = relationshipRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public CareAlertDto createAlert(Long elderlyId, AlertType alertType, AlertSeverity severity, String description) {
        User elderly = userRepository.findById(elderlyId)
                .orElseThrow(() -> new ApiException(404, "Elderly user not found"));

        // Find linked caregiver if any
        User caregiver = relationshipRepository.findByElderlyId(elderlyId)
                .stream()
                .findFirst()
                .map(rel -> rel.getCaregiver())
                .orElse(null);

        CareAlert alert = new CareAlert();
        alert.setElderly(elderly);
        alert.setCaregiver(caregiver);
        alert.setAlertType(alertType);
        alert.setSeverity(severity);
        alert.setDescription(description);
        alert.setIsRead(false);
        alert.setIsResolved(false);

        alert = alertRepository.save(alert);

        // Also notify caregiver directly
        if (caregiver != null) {
            notificationService.sendNotification(
                    caregiver.getId(),
                    "Cảnh báo chăm sóc: " + elderly.getFullName(),
                    description,
                    "ALERT",
                    alert.getId()
            );
        }

        return CareAlertDto.fromEntity(alert);
    }

    public List<CareAlertDto> getAlerts(Long currentUserId) {
        User user = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ApiException(404, "User not found"));

        if (user.getRole() == UserRole.CAREGIVER) {
            return alertRepository.findByCaregiverIdOrderByCreatedAtDesc(currentUserId)
                    .stream()
                    .map(CareAlertDto::fromEntity)
                    .collect(Collectors.toList());
        } else {
            return alertRepository.findByElderlyIdOrderByCreatedAtDesc(currentUserId)
                    .stream()
                    .map(CareAlertDto::fromEntity)
                    .collect(Collectors.toList());
        }
    }

    @Transactional
    public CareAlertDto markAsRead(Long currentUserId, Long alertId) {
        CareAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ApiException(404, "Alert not found"));

        alert.setIsRead(true);
        alert = alertRepository.save(alert);
        return CareAlertDto.fromEntity(alert);
    }

    @Transactional
    public CareAlertDto resolveAlert(Long currentUserId, Long alertId) {
        CareAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ApiException(404, "Alert not found"));

        alert.setIsResolved(true);
        alert.setResolvedAt(LocalDateTime.now());
        alert = alertRepository.save(alert);
        return CareAlertDto.fromEntity(alert);
    }
}
