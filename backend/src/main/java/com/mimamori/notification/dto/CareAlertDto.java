package com.mimamori.notification.dto;

import com.mimamori.notification.entity.AlertSeverity;
import com.mimamori.notification.entity.AlertType;
import com.mimamori.notification.entity.CareAlert;

import java.time.Instant;
import java.time.LocalDateTime;

public class CareAlertDto {
    private Long id;
    private Long elderlyId;
    private String elderlyName;
    private Long caregiverId;
    private AlertType alertType;
    private AlertSeverity severity;
    private String description;
    private Boolean isRead;
    private Boolean isResolved;
    private LocalDateTime resolvedAt;
    private Instant createdAt;

    public static CareAlertDto fromEntity(CareAlert alert) {
        if (alert == null) return null;
        CareAlertDto dto = new CareAlertDto();
        dto.setId(alert.getId());
        dto.setElderlyId(alert.getElderly().getId());
        dto.setElderlyName(alert.getElderly().getFullName());
        if (alert.getCaregiver() != null) dto.setCaregiverId(alert.getCaregiver().getId());
        dto.setAlertType(alert.getAlertType());
        dto.setSeverity(alert.getSeverity());
        dto.setDescription(alert.getDescription());
        dto.setIsRead(alert.getIsRead());
        dto.setIsResolved(alert.getIsResolved());
        dto.setResolvedAt(alert.getResolvedAt());
        dto.setCreatedAt(alert.getCreatedAt());
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getElderlyId() { return elderlyId; }
    public void setElderlyId(Long elderlyId) { this.elderlyId = elderlyId; }
    public String getElderlyName() { return elderlyName; }
    public void setElderlyName(String elderlyName) { this.elderlyName = elderlyName; }
    public Long getCaregiverId() { return caregiverId; }
    public void setCaregiverId(Long caregiverId) { this.caregiverId = caregiverId; }
    public AlertType getAlertType() { return alertType; }
    public void setAlertType(AlertType alertType) { this.alertType = alertType; }
    public AlertSeverity getSeverity() { return severity; }
    public void setSeverity(AlertSeverity severity) { this.severity = severity; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Boolean getIsRead() { return isRead; }
    public void setIsRead(Boolean isRead) { this.isRead = isRead; }
    public Boolean getIsResolved() { return isResolved; }
    public void setIsResolved(Boolean isResolved) { this.isResolved = isResolved; }
    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

