package com.mimamori.medication.dto;

import com.mimamori.medication.entity.MedicationStatus;

public class ConfirmMedicationRequest {
    private MedicationStatus status = MedicationStatus.TAKEN; // TAKEN or SKIPPED
    private String notes;

    public MedicationStatus getStatus() { return status; }
    public void setStatus(MedicationStatus status) { this.status = status; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}

