package com.mimamori.conversation.dto;

import com.mimamori.conversation.entity.DailyCheckIn;

import java.time.Instant;
import java.time.LocalDate;

public class DailyCheckInDto {
    private Long id;
    private Long elderlyId;
    private LocalDate checkinDate;
    private String mood;
    private String physicalHealth;
    private String sleepQuality;
    private String appetite;
    private String notes;
    private Boolean concerningFlag;
    private String aiAnalysisSummary;
    private Instant createdAt;

    public static DailyCheckInDto fromEntity(DailyCheckIn checkIn) {
        if (checkIn == null) return null;
        DailyCheckInDto dto = new DailyCheckInDto();
        dto.setId(checkIn.getId());
        dto.setElderlyId(checkIn.getElderly().getId());
        dto.setCheckinDate(checkIn.getCheckinDate());
        dto.setMood(checkIn.getMood());
        dto.setPhysicalHealth(checkIn.getPhysicalHealth());
        dto.setSleepQuality(checkIn.getSleepQuality());
        dto.setAppetite(checkIn.getAppetite());
        dto.setNotes(checkIn.getNotes());
        dto.setConcerningFlag(checkIn.getConcerningFlag());
        dto.setAiAnalysisSummary(checkIn.getAiAnalysisSummary());
        dto.setCreatedAt(checkIn.getCreatedAt());
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getElderlyId() { return elderlyId; }
    public void setElderlyId(Long elderlyId) { this.elderlyId = elderlyId; }
    public LocalDate getCheckinDate() { return checkinDate; }
    public void setCheckinDate(LocalDate checkinDate) { this.checkinDate = checkinDate; }
    public String getMood() { return mood; }
    public void setMood(String mood) { this.mood = mood; }
    public String getPhysicalHealth() { return physicalHealth; }
    public void setPhysicalHealth(String physicalHealth) { this.physicalHealth = physicalHealth; }
    public String getSleepQuality() { return sleepQuality; }
    public void setSleepQuality(String sleepQuality) { this.sleepQuality = sleepQuality; }
    public String getAppetite() { return appetite; }
    public void setAppetite(String appetite) { this.appetite = appetite; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Boolean getConcerningFlag() { return concerningFlag; }
    public void setConcerningFlag(Boolean concerningFlag) { this.concerningFlag = concerningFlag; }
    public String getAiAnalysisSummary() { return aiAnalysisSummary; }
    public void setAiAnalysisSummary(String aiAnalysisSummary) { this.aiAnalysisSummary = aiAnalysisSummary; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

