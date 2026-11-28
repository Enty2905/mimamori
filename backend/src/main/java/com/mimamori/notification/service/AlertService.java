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
        return createAlert(elderlyId, alertType, severity, description, alertType.name() + ":" + java.time.LocalDate.now());
    }

    @Transactional
    public CareAlertDto createAlert(Long elderlyId, AlertType alertType, AlertSeverity severity, String description, String eventKey) {
        User elderly = userRepository.findLockedById(elderlyId)
                .orElseThrow(() -> new ApiException(404, "Elderly user not found"));
        var caregivers = relationshipRepository.findByElderlyId(elderlyId).stream()
                .filter(link -> link.getStatus() == com.mimamori.userprofile.entity.RelationshipStatus.ACCEPTED)
                .map(link -> link.getCaregiver()).toList();
        var recipients = new java.util.ArrayList<User>(caregivers);
        if (recipients.isEmpty()) recipients.add(elderly);
        CareAlertDto first = null;
        for (User recipient : recipients) {
            String key = elderlyId + ":" + eventKey + ":" + recipient.getId();
            CareAlert alert = alertRepository.findByEventKey(key).orElse(null);
            if (alert == null) {
                alert = new CareAlert();
                alert.setElderly(elderly);
                if (!recipient.getId().equals(elderlyId)) alert.setCaregiver(recipient);
                alert.setAlertType(alertType); alert.setSeverity(severity);
                alert.setDescription(description); alert.setEventKey(key);
                alert = alertRepository.save(alert);
                notificationService.sendNotification(recipient.getId(), "Mimamori", "Mở Mimamori để xem thông báo chăm sóc.", "ALERT", alert.getId());
            }
            if (first == null) first = CareAlertDto.fromEntity(alert);
        }
        return first;
    }

    public List<CareAlertDto> getAlerts(Long currentUserId) {
        User user = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ApiException(404, "User not found"));

        if (user.getRole() == UserRole.CAREGIVER) {
            return alertRepository.findByCaregiverIdOrderByCreatedAtDesc(currentUserId)
                    .stream()
                    .filter(alert -> relationshipRepository.existsByCaregiverIdAndElderlyId(currentUserId,alert.getElderly().getId()))
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

        requireAccess(currentUserId, alert);
        alert.setIsRead(true);
        alert = alertRepository.save(alert);
        return CareAlertDto.fromEntity(alert);
    }

    @Transactional
    public CareAlertDto resolveAlert(Long currentUserId, Long alertId) {
        CareAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ApiException(404, "Alert not found"));

        requireAccess(currentUserId, alert);
        if (Boolean.TRUE.equals(alert.getIsResolved())) return CareAlertDto.fromEntity(alert);
        alert.setIsResolved(true);
        alert.setResolvedAt(LocalDateTime.now());
        alert = alertRepository.save(alert);
        return CareAlertDto.fromEntity(alert);
    }

    private void requireAccess(Long userId, CareAlert alert) {
        if (alert.getElderly().getId().equals(userId)) return;
        if (alert.getCaregiver() != null && alert.getCaregiver().getId().equals(userId)
                && relationshipRepository.existsByCaregiverIdAndElderlyId(userId, alert.getElderly().getId())) return;
        throw new ApiException(403, "Access to this alert is not permitted");
    }
}
