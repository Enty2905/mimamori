package com.mimamori.health.dto;

import com.mimamori.health.entity.HealthCondition;

import java.time.Instant;
import java.time.LocalDate;

public class HealthConditionDto {
    private Long id;
    private Long elderlyId;
    private String createdByName;
    private String conditionName;
    private String status;
    private String severity;
    private LocalDate recordDate;
    private LocalDate nextCheckupDate;
    private String doctorOrClinic;
    private String symptomsOrNotes;
    private Instant createdAt;
    private Instant updatedAt;

    public static HealthConditionDto fromEntity(HealthCondition entity) {
        if (entity == null) return null;
        HealthConditionDto dto = new HealthConditionDto();
        dto.setId(entity.getId());
        dto.setElderlyId(entity.getElderly().getId());
        dto.setCreatedByName(entity.getCreatedBy() != null ? entity.getCreatedBy().getFullName() : null);
        dto.setConditionName(entity.getConditionName());
        dto.setStatus(entity.getStatus());
        dto.setSeverity(entity.getSeverity());
        dto.setRecordDate(entity.getRecordDate());
        dto.setNextCheckupDate(entity.getNextCheckupDate());
        dto.setDoctorOrClinic(entity.getDoctorOrClinic());
        dto.setSymptomsOrNotes(entity.getSymptomsOrNotes());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getElderlyId() { return elderlyId; }
    public void setElderlyId(Long elderlyId) { this.elderlyId = elderlyId; }
    public String getCreatedByName() { return createdByName; }
    public void setCreatedByName(String createdByName) { this.createdByName = createdByName; }
    public String getConditionName() { return conditionName; }
    public void setConditionName(String conditionName) { this.conditionName = conditionName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
    public LocalDate getRecordDate() { return recordDate; }
    public void setRecordDate(LocalDate recordDate) { this.recordDate = recordDate; }
    public LocalDate getNextCheckupDate() { return nextCheckupDate; }
    public void setNextCheckupDate(LocalDate nextCheckupDate) { this.nextCheckupDate = nextCheckupDate; }
    public String getDoctorOrClinic() { return doctorOrClinic; }
    public void setDoctorOrClinic(String doctorOrClinic) { this.doctorOrClinic = doctorOrClinic; }
    public String getSymptomsOrNotes() { return symptomsOrNotes; }
    public void setSymptomsOrNotes(String symptomsOrNotes) { this.symptomsOrNotes = symptomsOrNotes; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
