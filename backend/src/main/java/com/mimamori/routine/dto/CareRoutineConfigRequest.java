package com.mimamori.routine.dto;

import java.util.List;

public class CareRoutineConfigRequest {
    private Integer waterTargetCups;
    private Integer waterTargetMl;
    private Integer waterCupMl;
    private List<String> waterReminderTimes;
    private String bedtimeTime;
    private String wakeupTime;
    private Double sleepTargetHours;
    private Boolean waterEnabled;
    private Boolean sleepEnabled;

    public Integer getWaterTargetCups() { return waterTargetCups; }
    public void setWaterTargetCups(Integer waterTargetCups) { this.waterTargetCups = waterTargetCups; }
    public Integer getWaterTargetMl() { return waterTargetMl; }
    public void setWaterTargetMl(Integer waterTargetMl) { this.waterTargetMl = waterTargetMl; }
    public Integer getWaterCupMl() { return waterCupMl; }
    public void setWaterCupMl(Integer waterCupMl) { this.waterCupMl = waterCupMl; }
    public List<String> getWaterReminderTimes() { return waterReminderTimes; }
    public void setWaterReminderTimes(List<String> waterReminderTimes) { this.waterReminderTimes = waterReminderTimes; }
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
}
