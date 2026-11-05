package com.mimamori.medication.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public class CreateMedicationRequest {

    private Long elderlyId; // Optional if called by elderly themselves

    @NotBlank(message = "Medication name is required")
    private String name;

    @NotBlank(message = "Dosage is required")
    private String dosage;

    private String instructions;

    @NotNull(message = "Start date is required")
    private LocalDate startDate;

    private LocalDate endDate;

    @NotEmpty(message = "At least one reminder time is required")
    private List<LocalTime> reminderTimes;

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
    public List<LocalTime> getReminderTimes() { return reminderTimes; }
    public void setReminderTimes(List<LocalTime> reminderTimes) { this.reminderTimes = reminderTimes; }
}

