package com.mimamori.routine.entity;

import com.mimamori.userprofile.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "care_routines")
public class CareRoutine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "elderly_id", nullable = false, unique = true)
    private User elderly;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "configured_by_id")
    private User configuredBy;

    @Column(name = "water_target_cups", nullable = false)
    private Integer waterTargetCups = 7;

    @Column(name = "water_target_ml", nullable = false)
    private Integer waterTargetMl = 1400;

    @Column(name = "water_cup_ml", nullable = false)
    private Integer waterCupMl = 200;

    @Column(name = "water_reminder_times", nullable = false, length = 255)
    private String waterReminderTimes = "08:00,10:30,14:00,16:30,20:00";

    @Column(name = "bedtime_time", nullable = false, length = 10)
    private String bedtimeTime = "21:30";

    @Column(name = "wakeup_time", nullable = false, length = 10)
    private String wakeupTime = "06:00";

    @Column(name = "sleep_target_hours", nullable = false)
    private Double sleepTargetHours = 8.0;

    @Column(name = "water_enabled", nullable = false)
    private Boolean waterEnabled = true;

    @Column(name = "sleep_enabled", nullable = false)
    private Boolean sleepEnabled = true;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    public CareRoutine() {}

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getElderly() { return elderly; }
    public void setElderly(User elderly) { this.elderly = elderly; }
    public User getConfiguredBy() { return configuredBy; }
    public void setConfiguredBy(User configuredBy) { this.configuredBy = configuredBy; }
    public Integer getWaterTargetCups() { return waterTargetCups; }
    public void setWaterTargetCups(Integer waterTargetCups) { this.waterTargetCups = waterTargetCups; }
    public Integer getWaterTargetMl() { return waterTargetMl; }
    public void setWaterTargetMl(Integer waterTargetMl) { this.waterTargetMl = waterTargetMl; }
    public Integer getWaterCupMl() { return waterCupMl; }
    public void setWaterCupMl(Integer waterCupMl) { this.waterCupMl = waterCupMl; }
    public String getWaterReminderTimes() { return waterReminderTimes; }
    public void setWaterReminderTimes(String waterReminderTimes) { this.waterReminderTimes = waterReminderTimes; }
    public String getBedtimeTime() { return bedtimeTime; }
    public void setBedtimeTime(String bedtimeTime) { this.bedtimeTime = bedtimeTime; }
    public String getWakeupTime() { return wakeupTime; }
    public void setWakeupTime(String wakeupTime) { this.wakeupTime = wakeupTime; }
    public Double getSleepTargetHours() { return sleepTargetHours; }
    public void setSleepTargetHours(Double sleepTargetHours) { this.sleepTargetHours = sleepTargetHours; }
    public Boolean getWaterEnabled() { return waterEnabled; }
    public void setWaterEnabled(Boolean waterEnabled) { this.waterEnabled = waterEnabled; }
    public Boolean getSleepEnabled() { return sleepEnabled; }
    public void setSleepEnabled(Boolean sleepEnabled) { this.sleepEnabled = sleepEnabled; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
