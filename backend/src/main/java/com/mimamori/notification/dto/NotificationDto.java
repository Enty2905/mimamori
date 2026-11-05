package com.mimamori.notification.dto;

import com.mimamori.notification.entity.Notification;

import java.time.Instant;

public class NotificationDto {
    private Long id;
    private Long userId;
    private String title;
    private String body;
    private String type;
    private Long referenceId;
    private Boolean isRead;
    private Instant createdAt;

    public static NotificationDto fromEntity(Notification notif) {
        if (notif == null) return null;
        NotificationDto dto = new NotificationDto();
        dto.setId(notif.getId());
        dto.setUserId(notif.getUser().getId());
        dto.setTitle(notif.getTitle());
        dto.setBody(notif.getBody());
        dto.setType(notif.getType());
        dto.setReferenceId(notif.getReferenceId());
        dto.setIsRead(notif.getIsRead());
        dto.setCreatedAt(notif.getCreatedAt());
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public Long getReferenceId() { return referenceId; }
    public void setReferenceId(Long referenceId) { this.referenceId = referenceId; }
    public Boolean getIsRead() { return isRead; }
    public void setIsRead(Boolean isRead) { this.isRead = isRead; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

