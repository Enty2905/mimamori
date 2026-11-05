package com.mimamori.conversation.controller;

import com.mimamori.common.ApiResponse;
import com.mimamori.conversation.dto.DailyCheckInDto;
import com.mimamori.conversation.dto.DailyCheckInRequest;
import com.mimamori.conversation.service.CheckInService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/checkins")
@Tag(name = "Daily Check-in", description = "Endpoints for elderly daily health & wellbeing check-ins")
public class CheckInController {

    private final CheckInService checkInService;

    public CheckInController(CheckInService checkInService) {
        this.checkInService = checkInService;
    }

    @PostMapping
    @Operation(summary = "Submit today's daily wellbeing check-in")
    public ApiResponse<DailyCheckInDto> submitCheckIn(
            @AuthenticationPrincipal Long elderlyId,
            @Valid @RequestBody DailyCheckInRequest request) {
        return ApiResponse.ok("Daily check-in submitted successfully", checkInService.submitCheckIn(elderlyId, request));
    }

    @GetMapping("/today")
    @Operation(summary = "Get today's check-in status for user or linked elderly")
    public ApiResponse<DailyCheckInDto> getTodayCheckIn(
            @AuthenticationPrincipal Long userId,
            @RequestParam(value = "elderlyId", required = false) Long elderlyId) {
        return ApiResponse.ok(checkInService.getTodayCheckIn(userId, elderlyId));
    }

    @GetMapping("/history")
    @Operation(summary = "Get check-in history")
    public ApiResponse<List<DailyCheckInDto>> getHistory(
            @AuthenticationPrincipal Long userId,
            @RequestParam(value = "elderlyId", required = false) Long elderlyId) {
        return ApiResponse.ok(checkInService.getHistory(userId, elderlyId));
    }
}
