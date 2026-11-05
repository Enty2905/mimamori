package com.mimamori.medication.dto;

import com.mimamori.medication.entity.MedicationLog;
import com.mimamori.medication.entity.MedicationStatus;

import java.time.LocalDateTime;

public class MedicationLogDto {
    private Long id;
    private Long scheduleId;
    private Long medicationId;
    private String medicationName;
    private String dosage;
    private LocalDateTime scheduledTime;
    private LocalDateTime takenTime;
    private MedicationStatus status;
    private String notes;

    public static MedicationLogDto fromEntity(MedicationLog log) {
        if (log == null) return null;
        MedicationLogDto dto = new MedicationLogDto();
        dto.setId(log.getId());
        if (log.getSchedule() != null) dto.setScheduleId(log.getSchedule().getId());
        dto.setMedicationId(log.getMedication().getId());
        dto.setMedicationName(log.getMedication().getName());
        dto.setDosage(log.getMedication().getDosage());
        dto.setScheduledTime(log.getScheduledTime());
        dto.setTakenTime(log.getTakenTime());
        dto.setStatus(log.getStatus());
        dto.setNotes(log.getNotes());
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getScheduleId() { return scheduleId; }
    public void setScheduleId(Long scheduleId) { this.scheduleId = scheduleId; }
    public Long getMedicationId() { return medicationId; }
    public void setMedicationId(Long medicationId) { this.medicationId = medicationId; }
    public String getMedicationName() { return medicationName; }
    public void setMedicationName(String medicationName) { this.medicationName = medicationName; }
    public String getDosage() { return dosage; }
    public void setDosage(String dosage) { this.dosage = dosage; }
    public LocalDateTime getScheduledTime() { return scheduledTime; }
    public void setScheduledTime(LocalDateTime scheduledTime) { this.scheduledTime = scheduledTime; }
    public LocalDateTime getTakenTime() { return takenTime; }
    public void setTakenTime(LocalDateTime takenTime) { this.takenTime = takenTime; }
    public MedicationStatus getStatus() { return status; }
    public void setStatus(MedicationStatus status) { this.status = status; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}

