package com.mimamori.agent.entity;

import com.mimamori.userprofile.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "daily_summaries", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"elderly_id", "summary_date"})
})
public class DailySummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "elderly_id", nullable = false)
    private User elderly;

    @Column(name = "summary_date", nullable = false)
    private LocalDate summaryDate;

    @Column(name = "medication_adherence_rate")
    private Double medicationAdherenceRate;

    @Column(name = "checkin_summary", columnDefinition = "TEXT")
    private String checkinSummary;

    @Column(name = "alert_count")
    private Integer alertCount = 0;

    @Column(name = "ai_health_note", columnDefinition = "TEXT")
    private String aiHealthNote;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    public DailySummary() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getElderly() { return elderly; }
    public void setElderly(User elderly) { this.elderly = elderly; }
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

