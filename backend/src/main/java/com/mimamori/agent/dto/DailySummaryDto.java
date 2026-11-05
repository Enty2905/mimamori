package com.mimamori.agent.dto;

import com.mimamori.agent.entity.DailySummary;

import java.time.Instant;
import java.time.LocalDate;

public class DailySummaryDto {
    private Long id;
    private Long elderlyId;
    private LocalDate summaryDate;
    private Double medicationAdherenceRate;
    private String checkinSummary;
    private Integer alertCount;
    private String aiHealthNote;
    private Instant createdAt;

    public static DailySummaryDto fromEntity(DailySummary summary) {
        if (summary == null) return null;
        DailySummaryDto dto = new DailySummaryDto();
        dto.setId(summary.getId());
        dto.setElderlyId(summary.getElderly().getId());
        dto.setSummaryDate(summary.getSummaryDate());
        dto.setMedicationAdherenceRate(summary.getMedicationAdherenceRate());
        dto.setCheckinSummary(summary.getCheckinSummary());
        dto.setAlertCount(summary.getAlertCount());
        dto.setAiHealthNote(summary.getAiHealthNote());
        dto.setCreatedAt(summary.getCreatedAt());
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getElderlyId() { return elderlyId; }
    public void setElderlyId(Long elderlyId) { this.elderlyId = elderlyId; }
    public LocalDate getSummaryDate() { return summaryDate; }
    public void setSummaryDate(LocalDate summaryDate) { this.summaryDate = summaryDate; }
    public Double getMedicationAdherenceRate() { return medicationAdherenceRate; }
    public void setMedicationAdherenceRate(Double medicationAdherenceRate) { this.medicationAdherenceRate = medicationAdherenceRate; }
    public String getCheckinSummary() { return checkinSummary; }
    public void setCheckinSummary(String checkinSummary) { this.checkinSummary = checkinSummary; }
    public Integer getAlertCount() { return alertCount; }
    public void setAlertCount(Integer alertCount) { this.alertCount = alertCount; }
    public String getAiHealthNote() { return aiHealthNote; }
    public void setAiHealthNote(String aiHealthNote) { this.aiHealthNote = aiHealthNote; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

