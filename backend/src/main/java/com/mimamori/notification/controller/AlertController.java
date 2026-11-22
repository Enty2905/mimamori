package com.mimamori.notification.controller;

import com.mimamori.common.ApiResponse;
import com.mimamori.notification.dto.CareAlertDto;
import com.mimamori.notification.entity.AlertSeverity;
import com.mimamori.notification.entity.AlertType;
import com.mimamori.notification.service.AlertService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/alerts")
@Tag(name = "Care Alerts", description = "Endpoints for care alerts, missed checkin/medication warnings, and resolution")
public class AlertController {

    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping
    @Operation(summary = "Get care alerts for current user")
    public ApiResponse<List<CareAlertDto>> getAlerts(@AuthenticationPrincipal Long userId) {
        return ApiResponse.ok(alertService.getAlerts(userId));
    }

    @PostMapping("/sos")
    @Operation(summary = "Trigger an emergency SOS alert from elderly user to linked caregiver")
    public ApiResponse<CareAlertDto> triggerSosAlert(
            @AuthenticationPrincipal Long elderlyId,
            @RequestBody(required = false) Map<String, String> payload) {
        String customMessage = payload != null ? payload.get("message") : null;
        String description = (customMessage != null && !customMessage.isBlank())
                ? customMessage.trim()
                : "TÍN HIỆU KHẨN CẤP (SOS): Người cao tuổi vừa nhấn nút cần trợ giúp khẩn cấp!";
        return ApiResponse.ok(
                "SOS alert sent to caregiver",
                alertService.createAlert(elderlyId, AlertType.SYSTEM_NOTIFICATION, AlertSeverity.CRITICAL, description)
        );
    }

    @PutMapping("/{id}/read")
    @Operation(summary = "Mark an alert as read")
    public ApiResponse<CareAlertDto> markAsRead(
            @AuthenticationPrincipal Long userId,
            @PathVariable("id") Long alertId) {
        return ApiResponse.ok(alertService.markAsRead(userId, alertId));
    }

    @PutMapping("/{id}/resolve")
    @Operation(summary = "Mark an alert as resolved / acknowledged")
    public ApiResponse<CareAlertDto> resolveAlert(
            @AuthenticationPrincipal Long userId,
            @PathVariable("id") Long alertId) {
        return ApiResponse.ok("Alert resolved successfully", alertService.resolveAlert(userId, alertId));
    }
}
