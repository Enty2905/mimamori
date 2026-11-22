package com.mimamori.routine.dto;

public class ConfirmCareRoutineRequest {
    private String status; // COMPLETED or SKIPPED
    private String note;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
