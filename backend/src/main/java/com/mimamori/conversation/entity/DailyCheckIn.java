package com.mimamori.conversation.entity;

import com.mimamori.userprofile.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "daily_checkins", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"elderly_id", "checkin_date"})
})
public class DailyCheckIn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "elderly_id", nullable = false)
    private User elderly;

    @Column(name = "checkin_date", nullable = false)
    private LocalDate checkinDate;

    @Column(nullable = false, length = 20)
    private String mood; // EXCELLENT, GOOD, OKAY, TIRED, POOR

    @Column(name = "physical_health", nullable = false, length = 50)
    private String physicalHealth; // GOOD, TIRED, PAIN, DIZZY, etc.

    @Column(name = "sleep_quality", nullable = false, length = 20)
    private String sleepQuality; // GOOD, NORMAL, POOR, INSOMNIA

    @Column(nullable = false, length = 20)
    private String appetite; // GOOD, NORMAL, POOR

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "concerning_flag")
    private Boolean concerningFlag = false;

    @Column(name = "ai_analysis_summary", columnDefinition = "TEXT")
    private String aiAnalysisSummary;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    public DailyCheckIn() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getElderly() { return elderly; }
    public void setElderly(User elderly) { this.elderly = elderly; }
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

