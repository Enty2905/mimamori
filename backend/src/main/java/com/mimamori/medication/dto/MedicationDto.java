package com.mimamori.medication.dto;

import com.mimamori.medication.entity.Medication;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

public class MedicationDto {
    private Long id;
    private String timeZone;
    private Long elderlyId;
    private String name;
    private String dosage;
    private String instructions;
    private LocalDate startDate;
    private LocalDate endDate;
    private Boolean isActive;
    private List<MedicationScheduleDto> schedules;
    private Instant createdAt;

    public static MedicationDto fromEntity(Medication med) {
        if (med == null) return null;
        MedicationDto dto = new MedicationDto();
        dto.setId(med.getId());
        dto.timeZone = med.getTimeZone();
        dto.setElderlyId(med.getElderly().getId());
        dto.setName(med.getName());
        dto.setDosage(med.getDosage());
        dto.setInstructions(med.getInstructions());
        dto.setStartDate(med.getStartDate());
        dto.setEndDate(med.getEndDate());
        dto.setIsActive(med.getIsActive());
        dto.setCreatedAt(med.getCreatedAt());
        if (med.getSchedules() != null) {
            dto.setSchedules(med.getSchedules().stream().filter(schedule -> schedule.isActive())
                    .map(MedicationScheduleDto::fromEntity)
                    .collect(Collectors.toList()));
        }
        return dto;
    }

    public Long getId() { return id; }
    public String getTimeZone() { return timeZone; }
    public void setId(Long id) { this.id = id; }
    public Long getElderlyId() { return elderlyId; }
    public void setElderlyId(Long elderlyId) { this.elderlyId = elderlyId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDosage() { return dosage; }
    public void setDosage(String dosage) { this.dosage = dosage; }
    public String getInstructions() { return instructions; }
    public void setInstructions(String instructions) { this.instructions = instructions; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public List<MedicationScheduleDto> getSchedules() { return schedules; }
    public void setSchedules(List<MedicationScheduleDto> schedules) { this.schedules = schedules; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

