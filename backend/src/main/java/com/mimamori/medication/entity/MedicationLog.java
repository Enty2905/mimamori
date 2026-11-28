package com.mimamori.medication.entity;

import com.mimamori.userprofile.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDateTime;

@Entity
@Table(name = "medication_logs")
public class MedicationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "occurrence_id", nullable = false, unique = true, length = 64)
    private String occurrenceId;
    @Column(name = "scheduled_at", nullable = false)
    private Instant scheduledAt;
    @Column(name = "confirmed_at")
    private Instant confirmedAt;
    @Column(nullable = false)
    private boolean canceled;
    @Column(name = "reminder_sent", nullable = false)
    private boolean reminderSent;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schedule_id")
    private MedicationSchedule schedule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "medication_id", nullable = false)
    private Medication medication;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "elderly_id", nullable = false)
    private User elderly;

    @Column(name = "scheduled_time", nullable = false)
    private LocalDateTime scheduledTime;

    @Column(name = "taken_time")
    private LocalDateTime takenTime;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private MedicationStatus status = MedicationStatus.PENDING;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    public MedicationLog() {}

    public Long getId() { return id; }
    public String getOccurrenceId() { return occurrenceId; }
    public void setOccurrenceId(String value) { occurrenceId = value; }
    public Instant getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(Instant value) { scheduledAt = value; }
    public Instant getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(Instant value) { confirmedAt = value; }
    public boolean isCanceled() { return canceled; }
    public void setCanceled(boolean value) { canceled = value; }
    public boolean isReminderSent() { return reminderSent; }
    public void setReminderSent(boolean value) { reminderSent = value; }
    public void setId(Long id) { this.id = id; }
    public MedicationSchedule getSchedule() { return schedule; }
    public void setSchedule(MedicationSchedule schedule) { this.schedule = schedule; }
    public Medication getMedication() { return medication; }
    public void setMedication(Medication medication) { this.medication = medication; }
    public User getElderly() { return elderly; }
    public void setElderly(User elderly) { this.elderly = elderly; }
    public LocalDateTime getScheduledTime() { return scheduledTime; }
    public void setScheduledTime(LocalDateTime scheduledTime) { this.scheduledTime = scheduledTime; }
    public LocalDateTime getTakenTime() { return takenTime; }
    public void setTakenTime(LocalDateTime takenTime) { this.takenTime = takenTime; }
    public MedicationStatus getStatus() { return status; }
    public void setStatus(MedicationStatus status) { this.status = status; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

