package com.mimamori.health.controller;

import com.mimamori.common.ApiResponse;
import com.mimamori.health.dto.CreateHealthConditionRequest;
import com.mimamori.health.dto.HealthConditionDto;
import com.mimamori.health.service.HealthConditionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/health-conditions")
@Tag(name = "Health Conditions & Checkups", description = "Track elderly medical conditions, doctor follow-ups, and care notes")
public class HealthConditionController {

    private final HealthConditionService healthConditionService;

    public HealthConditionController(HealthConditionService healthConditionService) {
        this.healthConditionService = healthConditionService;
    }

    @GetMapping
    @Operation(summary = "Get medical conditions and checkup records for user or linked elderly")
    public ApiResponse<List<HealthConditionDto>> getConditions(
            @AuthenticationPrincipal Long userId,
            @RequestParam(value = "elderlyId", required = false) Long elderlyId) {
        return ApiResponse.ok(healthConditionService.getConditions(userId, elderlyId));
    }

    @PostMapping
    @Operation(summary = "Create a new medical condition or checkup record")
    public ApiResponse<HealthConditionDto> createCondition(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody CreateHealthConditionRequest request) {
        return ApiResponse.ok("Health condition saved successfully", healthConditionService.createCondition(userId, request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a medical condition or follow-up checkup note")
    public ApiResponse<HealthConditionDto> updateCondition(
            @AuthenticationPrincipal Long userId,
            @PathVariable("id") Long conditionId,
            @Valid @RequestBody CreateHealthConditionRequest request) {
        return ApiResponse.ok("Health condition updated successfully", healthConditionService.updateCondition(userId, conditionId, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a medical condition record")
    public ApiResponse<Void> deleteCondition(
            @AuthenticationPrincipal Long userId,
            @PathVariable("id") Long conditionId) {
        healthConditionService.deleteCondition(userId, conditionId);
        return ApiResponse.ok("Health condition deleted successfully", null);
    }
}
