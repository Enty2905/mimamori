package com.mimamori.agent.dto;

import com.mimamori.conversation.dto.DailyCheckInDto;
import com.mimamori.medication.dto.MedicationLogDto;
import com.mimamori.notification.dto.CareAlertDto;
import com.mimamori.userprofile.dto.UserDto;

import java.util.List;

public class DashboardOverviewDto {
    private UserDto elderly;
    private String careStatus; // NORMAL, NEEDS_ATTENTION, WARNING
    private DailyCheckInDto todayCheckIn;
    private List<MedicationLogDto> todayMedications;
    private double medicationAdherence;
    private List<CareAlertDto> activeAlerts;
    private DailySummaryDto recentSummary;

    public UserDto getElderly() { return elderly; }
    public void setElderly(UserDto elderly) { this.elderly = elderly; }
    public String getCareStatus() { return careStatus; }
    public void setCareStatus(String careStatus) { this.careStatus = careStatus; }
    public DailyCheckInDto getTodayCheckIn() { return todayCheckIn; }
    public void setTodayCheckIn(DailyCheckInDto todayCheckIn) { this.todayCheckIn = todayCheckIn; }
    public List<MedicationLogDto> getTodayMedications() { return todayMedications; }
    public void setTodayMedications(List<MedicationLogDto> todayMedications) { this.todayMedications = todayMedications; }
    public double getMedicationAdherence() { return medicationAdherence; }
    public void setMedicationAdherence(double medicationAdherence) { this.medicationAdherence = medicationAdherence; }
    public List<CareAlertDto> getActiveAlerts() { return activeAlerts; }
    public void setActiveAlerts(List<CareAlertDto> activeAlerts) { this.activeAlerts = activeAlerts; }
    public DailySummaryDto getRecentSummary() { return recentSummary; }
    public void setRecentSummary(DailySummaryDto recentSummary) { this.recentSummary = recentSummary; }
}

