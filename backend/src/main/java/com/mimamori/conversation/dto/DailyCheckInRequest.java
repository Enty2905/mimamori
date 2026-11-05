package com.mimamori.conversation.dto;

import jakarta.validation.constraints.NotBlank;

public class DailyCheckInRequest {

    @NotBlank(message = "Mood is required (EXCELLENT, GOOD, OKAY, TIRED, POOR)")
    private String mood;

    @NotBlank(message = "Physical health status is required")
    private String physicalHealth;

    @NotBlank(message = "Sleep quality is required")
    private String sleepQuality;

    @NotBlank(message = "Appetite is required")
    private String appetite;

    private String notes;

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
}

