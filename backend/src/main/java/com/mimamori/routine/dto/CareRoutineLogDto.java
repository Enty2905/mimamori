package com.mimamori.routine.dto;

import com.mimamori.routine.entity.CareRoutineLog;

import java.time.LocalDateTime;

public class CareRoutineLogDto {
    private Long id;
    private String routineType;
    private String scheduledTime;
    private String status;
    private LocalDateTime completedAt;
    private String note;

    public static CareRoutineLogDto fromEntity(CareRoutineLog log) {
        if (log == null) return null;
        CareRoutineLogDto dto = new CareRoutineLogDto();
        dto.setId(log.getId());
        dto.setRoutineType(log.getRoutineType());
        dto.setScheduledTime(log.getScheduledTime());
        dto.setStatus(log.getStatus());
        dto.setCompletedAt(log.getCompletedAt());
        dto.setNote(log.getNote());
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRoutineType() { return routineType; }
    public void setRoutineType(String routineType) { this.routineType = routineType; }
    public String getScheduledTime() { return scheduledTime; }
    public void setScheduledTime(String scheduledTime) { this.scheduledTime = scheduledTime; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
