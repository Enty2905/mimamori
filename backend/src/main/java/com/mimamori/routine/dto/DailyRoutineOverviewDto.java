package com.mimamori.routine.dto;

import java.time.LocalDateTime;
import java.util.List;

public class DailyRoutineOverviewDto {
    private Long elderlyId;
    private int waterTargetCups;
    private int waterCompletedCups;
    private int waterTargetMl;
    private int waterCupMl;
    private int waterCompletedMl;
    private int hydrationPercent;
    private String hydrationStatus;
    private String hydrationEvaluationText;
    private List<String> waterReminderTimes;
    private boolean waterEnabled;
    private String bedtimeTime;
    private String wakeupTime;
    private double sleepTargetHours;
    private boolean sleepEnabled;
    private String sleepStatus;
    private LocalDateTime sleepCompletedAt;
    private String lastNightSleepQuality;
    private List<CareRoutineLogDto> logs;

    public Long getElderlyId() { return elderlyId; }
    public void setElderlyId(Long elderlyId) { this.elderlyId = elderlyId; }
    public int getWaterTargetCups() { return waterTargetCups; }
    public void setWaterTargetCups(int waterTargetCups) { this.waterTargetCups = waterTargetCups; }
    public int getWaterCompletedCups() { return waterCompletedCups; }
    public void setWaterCompletedCups(int waterCompletedCups) { this.waterCompletedCups = waterCompletedCups; }
    public int getWaterTargetMl() { return waterTargetMl; }
    public void setWaterTargetMl(int waterTargetMl) { this.waterTargetMl = waterTargetMl; }
    public int getWaterCupMl() { return waterCupMl; }
    public void setWaterCupMl(int waterCupMl) { this.waterCupMl = waterCupMl; }
    public int getWaterCompletedMl() { return waterCompletedMl; }
    public void setWaterCompletedMl(int waterCompletedMl) { this.waterCompletedMl = waterCompletedMl; }
    public int getHydrationPercent() { return hydrationPercent; }
    public void setHydrationPercent(int hydrationPercent) { this.hydrationPercent = hydrationPercent; }
    public String getHydrationStatus() { return hydrationStatus; }
    public void setHydrationStatus(String hydrationStatus) { this.hydrationStatus = hydrationStatus; }
    public String getHydrationEvaluationText() { return hydrationEvaluationText; }
    public void setHydrationEvaluationText(String hydrationEvaluationText) { this.hydrationEvaluationText = hydrationEvaluationText; }
    public List<String> getWaterReminderTimes() { return waterReminderTimes; }
    public void setWaterReminderTimes(List<String> waterReminderTimes) { this.waterReminderTimes = waterReminderTimes; }
    public boolean isWaterEnabled() { return waterEnabled; }
    public void setWaterEnabled(boolean waterEnabled) { this.waterEnabled = waterEnabled; }
    public String getBedtimeTime() { return bedtimeTime; }
    public void setBedtimeTime(String bedtimeTime) { this.bedtimeTime = bedtimeTime; }
    public String getWakeupTime() { return wakeupTime; }
    public void setWakeupTime(String wakeupTime) { this.wakeupTime = wakeupTime; }
    public double getSleepTargetHours() { return sleepTargetHours; }
    public void setSleepTargetHours(double sleepTargetHours) { this.sleepTargetHours = sleepTargetHours; }
    public boolean isSleepEnabled() { return sleepEnabled; }
    public void setSleepEnabled(boolean sleepEnabled) { this.sleepEnabled = sleepEnabled; }
    public String getSleepStatus() { return sleepStatus; }
    public void setSleepStatus(String sleepStatus) { this.sleepStatus = sleepStatus; }
    public LocalDateTime getSleepCompletedAt() { return sleepCompletedAt; }
    public void setSleepCompletedAt(LocalDateTime sleepCompletedAt) { this.sleepCompletedAt = sleepCompletedAt; }
    public String getLastNightSleepQuality() { return lastNightSleepQuality; }
    public void setLastNightSleepQuality(String lastNightSleepQuality) { this.lastNightSleepQuality = lastNightSleepQuality; }
    public List<CareRoutineLogDto> getLogs() { return logs; }
    public void setLogs(List<CareRoutineLogDto> logs) { this.logs = logs; }
}
