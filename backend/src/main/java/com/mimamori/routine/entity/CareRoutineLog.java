package com.mimamori.routine.entity;

import com.mimamori.userprofile.entity.User;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "care_routine_logs",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_routine_slot", columnNames = {"elderly_id", "routine_date", "routine_type", "scheduled_time"})
    }
)
public class CareRoutineLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "elderly_id", nullable = false)
    private User elderly;

    @Column(name = "routine_date", nullable = false)
    private LocalDate routineDate;

    @Column(name = "routine_type", nullable = false, length = 20)
    private String routineType; // WATER, SLEEP

    @Column(name = "scheduled_time", nullable = false, length = 10)
    private String scheduledTime;

    @Column(nullable = false, length = 20)
    private String status = "PENDING"; // PENDING, COMPLETED, SKIPPED

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    public CareRoutineLog() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getElderly() { return elderly; }
    public void setElderly(User elderly) { this.elderly = elderly; }
    public LocalDate getRoutineDate() { return routineDate; }
    public void setRoutineDate(LocalDate routineDate) { this.routineDate = routineDate; }
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
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
