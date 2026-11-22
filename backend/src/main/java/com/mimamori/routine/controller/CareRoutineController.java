package com.mimamori.routine.controller;

import com.mimamori.common.ApiResponse;
import com.mimamori.routine.dto.CareRoutineConfigRequest;
import com.mimamori.routine.dto.ConfirmCareRoutineRequest;
import com.mimamori.routine.dto.DailyRoutineOverviewDto;
import com.mimamori.routine.service.CareRoutineService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/routines")
@Tag(name = "Care Routines", description = "Endpoints for water intake & sleep routine configuration, today's schedule, and confirmations")
public class CareRoutineController {

    private final CareRoutineService careRoutineService;

    public CareRoutineController(CareRoutineService careRoutineService) {
        this.careRoutineService = careRoutineService;
    }

    @GetMapping("/today")
    @Operation(summary = "Get today's water and sleep routine overview and log slots")
    public ApiResponse<DailyRoutineOverviewDto> getTodayRoutine(
            @AuthenticationPrincipal Long userId,
            @RequestParam(value = "elderlyId", required = false) Long elderlyId) {
        return ApiResponse.ok(careRoutineService.getTodayRoutine(userId, elderlyId));
    }

    @PutMapping("/config")
    @Operation(summary = "Update water and sleep routine configuration and reconcile today's pending slots")
    public ApiResponse<DailyRoutineOverviewDto> updateConfig(
            @AuthenticationPrincipal Long userId,
            @RequestParam(value = "elderlyId", required = false) Long elderlyId,
            @RequestBody CareRoutineConfigRequest request) {
        return ApiResponse.ok("Care routine updated successfully",
                careRoutineService.updateConfig(userId, elderlyId, request));
    }

    @PostMapping("/logs/{id}/confirm")
    @Operation(summary = "Confirm or skip a scheduled routine log slot")
    public ApiResponse<DailyRoutineOverviewDto> confirmLog(
            @AuthenticationPrincipal Long userId,
            @PathVariable("id") Long logId,
            @RequestBody(required = false) ConfirmCareRoutineRequest request) {
        return ApiResponse.ok("Routine confirmation recorded",
                careRoutineService.confirmLog(userId, logId, request));
    }

    @PostMapping("/water/quick-add")
    @Operation(summary = "Log an extra cup of water immediately as completed")
    public ApiResponse<DailyRoutineOverviewDto> quickAddWater(
            @AuthenticationPrincipal Long userId,
            @RequestParam(value = "elderlyId", required = false) Long elderlyId,
            @RequestBody(required = false) ConfirmCareRoutineRequest request) {
        return ApiResponse.ok("Extra cup of water logged",
                careRoutineService.quickAddWater(userId, elderlyId, request));
    }
}
