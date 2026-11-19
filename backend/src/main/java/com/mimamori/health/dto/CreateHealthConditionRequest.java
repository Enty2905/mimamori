package com.mimamori.health.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public class CreateHealthConditionRequest {

    private Long elderlyId;

    @NotBlank(message = "Condition name is required")
    private String conditionName;

    private String status;

    private String severity;

    private LocalDate recordDate;

    private LocalDate nextCheckupDate;

    private String doctorOrClinic;

    private String symptomsOrNotes;

    public Long getElderlyId() { return elderlyId; }
    public void setElderlyId(Long elderlyId) { this.elderlyId = elderlyId; }
    public String getConditionName() { return conditionName; }
    public void setConditionName(String conditionName) { this.conditionName = conditionName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
    public LocalDate getRecordDate() { return recordDate; }
    public void setRecordDate(LocalDate recordDate) { this.recordDate = recordDate; }
    public LocalDate getNextCheckupDate() { return nextCheckupDate; }
    public void setNextCheckupDate(LocalDate nextCheckupDate) { this.nextCheckupDate = nextCheckupDate; }
    public String getDoctorOrClinic() { return doctorOrClinic; }
    public void setDoctorOrClinic(String doctorOrClinic) { this.doctorOrClinic = doctorOrClinic; }
    public String getSymptomsOrNotes() { return symptomsOrNotes; }
    public void setSymptomsOrNotes(String symptomsOrNotes) { this.symptomsOrNotes = symptomsOrNotes; }
}
