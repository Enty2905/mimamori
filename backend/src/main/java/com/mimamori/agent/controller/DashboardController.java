package com.mimamori.agent.controller;

import com.mimamori.agent.dto.DashboardOverviewDto;
import com.mimamori.agent.service.DashboardService;
import com.mimamori.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
@Tag(name = "Caregiver & Elderly Dashboard", description = "Endpoints for remote monitoring, status overview, adherence and summaries")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/overview")
    @Operation(summary = "Get aggregated health, medication, check-in, alert, and status overview")
    public ApiResponse<DashboardOverviewDto> getOverview(
            @AuthenticationPrincipal Long userId,
            @RequestParam(value = "elderlyId", required = false) Long elderlyId) {
        return ApiResponse.ok(dashboardService.getOverview(userId, elderlyId));
    }
}
