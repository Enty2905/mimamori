package com.mimamori.medication.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalTime;

@Entity
@Table(name = "medication_schedules")
public class MedicationSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "medication_id", nullable = false)
    private Medication medication;

    @Column(name = "reminder_time", nullable = false)
    private LocalTime reminderTime;

    @Column(name = "dosage_amount", length = 50)
    private String dosageAmount;

    @Column(name = "days_of_week", length = 20)
    private String daysOfWeek = "DAILY";

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    public MedicationSchedule() {}

    public MedicationSchedule(Medication medication, LocalTime reminderTime, String dosageAmount) {
        this.medication = medication;
        this.reminderTime = reminderTime;
        this.dosageAmount = dosageAmount;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Medication getMedication() { return medication; }
    public void setMedication(Medication medication) { this.medication = medication; }
    public LocalTime getReminderTime() { return reminderTime; }
    public void setReminderTime(LocalTime reminderTime) { this.reminderTime = reminderTime; }
    public String getDosageAmount() { return dosageAmount; }
    public void setDosageAmount(String dosageAmount) { this.dosageAmount = dosageAmount; }
    public String getDaysOfWeek() { return daysOfWeek; }
    public void setDaysOfWeek(String daysOfWeek) { this.daysOfWeek = daysOfWeek; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

