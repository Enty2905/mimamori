package com.mimamori.medication.dto;

import com.mimamori.medication.entity.MedicationStatus;

public class ConfirmMedicationRequest {
    private MedicationStatus status = MedicationStatus.TAKEN; // TAKEN or SKIPPED
    private String notes;
    private java.time.Instant confirmedAt;

    public MedicationStatus getStatus() { return status; }
    public void setStatus(MedicationStatus status) { this.status = status; }
    public String getNotes() { return notes; }
    public java.time.Instant getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(java.time.Instant value) { confirmedAt = value; }
    public void setNotes(String notes) { this.notes = notes; }
}

