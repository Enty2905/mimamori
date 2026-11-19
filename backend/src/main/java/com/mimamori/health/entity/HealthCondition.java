package com.mimamori.health.entity;

import com.mimamori.userprofile.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "health_conditions")
public class HealthCondition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "elderly_id", nullable = false)
    private User elderly;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    @Column(name = "condition_name", nullable = false, length = 150)
    private String conditionName;

    @Column(nullable = false, length = 30)
    private String status = "MONITORING";

    @Column(nullable = false, length = 20)
    private String severity = "MODERATE";

    @Column(name = "record_date", nullable = false)
    private LocalDate recordDate;

    @Column(name = "next_checkup_date")
    private LocalDate nextCheckupDate;

    @Column(name = "doctor_or_clinic", length = 150)
    private String doctorOrClinic;

    @Column(name = "symptoms_or_notes", columnDefinition = "TEXT")
    private String symptomsOrNotes;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    public HealthCondition() {}

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getElderly() { return elderly; }
    public void setElderly(User elderly) { this.elderly = elderly; }
    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
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
