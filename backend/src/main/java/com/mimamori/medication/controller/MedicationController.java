package com.mimamori.medication.controller;

import com.mimamori.common.ApiResponse;
import com.mimamori.medication.dto.ConfirmMedicationRequest;
import com.mimamori.medication.dto.CreateMedicationRequest;
import com.mimamori.medication.dto.MedicationDto;
import com.mimamori.medication.dto.MedicationLogDto;
import com.mimamori.medication.service.MedicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/medications")
@Tag(name = "Medication Management", description = "Endpoints for managing medications, schedules, reminders and confirmation")
public class MedicationController {

    private final MedicationService medicationService;

    public MedicationController(MedicationService medicationService) {
        this.medicationService = medicationService;
    }

    @PostMapping
    @Operation(summary = "Create a new medication with reminder schedules")
    public ApiResponse<MedicationDto> createMedication(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody CreateMedicationRequest request) {
        return ApiResponse.ok("Medication created successfully", medicationService.createMedication(userId, request));
    }

    @GetMapping
    @Operation(summary = "Get list of active medications for user or linked elderly")
    public ApiResponse<List<MedicationDto>> getMedications(
            @AuthenticationPrincipal Long userId,
            @RequestParam(value = "elderlyId", required = false) Long elderlyId) {
        return ApiResponse.ok(medicationService.getMedications(userId, elderlyId));
    }

    @PutMapping("/{id}")
    public ApiResponse<MedicationDto> updateMedication(@AuthenticationPrincipal Long userId,
            @PathVariable("id") Long id, @Valid @RequestBody CreateMedicationRequest request) {
        return ApiResponse.ok(medicationService.updateMedication(userId, id, request));
    }

    @GetMapping("/today")
    @Operation(summary = "Get today's medication reminder schedules and statuses")
    public ApiResponse<List<MedicationLogDto>> getTodaySchedule(
            @AuthenticationPrincipal Long userId,
            @RequestParam(value = "elderlyId", required = false) Long elderlyId) {
        return ApiResponse.ok(medicationService.getTodaySchedule(userId, elderlyId));
    }

    @PostMapping("/logs/{id}/confirm")
    @Operation(summary = "Confirm medication has been taken or skipped")
    public ApiResponse<MedicationLogDto> confirmMedication(
            @AuthenticationPrincipal Long userId,
            @PathVariable("id") Long logId,
            @RequestBody ConfirmMedicationRequest request) {
        return ApiResponse.ok("Medication confirmation recorded", medicationService.confirmMedication(userId, logId, request));
    }

    @GetMapping("/logs/{id}")
    public ApiResponse<MedicationLogDto> dose(@AuthenticationPrincipal Long userId, @PathVariable("id") Long id) {
        return ApiResponse.ok(medicationService.getDose(userId,id));
    }

    @GetMapping("/history")
    @Operation(summary = "Get medication adherence history")
    public ApiResponse<List<MedicationLogDto>> getHistory(
            @AuthenticationPrincipal Long userId,
            @RequestParam(value = "elderlyId", required = false) Long elderlyId) {
        return ApiResponse.ok(medicationService.getHistory(userId, elderlyId));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Deactivate/delete a medication")
    public ApiResponse<Void> deleteMedication(
            @AuthenticationPrincipal Long userId,
            @PathVariable("id") Long medicationId) {
        medicationService.deleteMedication(userId, medicationId);
        return ApiResponse.ok("Medication deactivated successfully", null);
    }
}
