package com.mimamori.medication.dto;

import com.mimamori.medication.entity.MedicationSchedule;

import java.time.LocalTime;

public class MedicationScheduleDto {
    private Long id;
    private LocalTime reminderTime;
    private String dosageAmount;
    private String daysOfWeek;

    public static MedicationScheduleDto fromEntity(MedicationSchedule schedule) {
        if (schedule == null) return null;
        MedicationScheduleDto dto = new MedicationScheduleDto();
        dto.setId(schedule.getId());
        dto.setReminderTime(schedule.getReminderTime());
        dto.setDosageAmount(schedule.getDosageAmount());
        dto.setDaysOfWeek(schedule.getDaysOfWeek());
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public LocalTime getReminderTime() { return reminderTime; }
    public void setReminderTime(LocalTime reminderTime) { this.reminderTime = reminderTime; }
    public String getDosageAmount() { return dosageAmount; }
    public void setDosageAmount(String dosageAmount) { this.dosageAmount = dosageAmount; }
    public String getDaysOfWeek() { return daysOfWeek; }
    public void setDaysOfWeek(String daysOfWeek) { this.daysOfWeek = daysOfWeek; }
}

