package com.mimamori.notification.controller;

import com.mimamori.common.ApiResponse;
import com.mimamori.notification.dto.NotificationDto;
import com.mimamori.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@Tag(name = "Push Notifications", description = "Endpoints for in-app reminders and notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    @Operation(summary = "Get notifications for authenticated user")
    public ApiResponse<List<NotificationDto>> getNotifications(@AuthenticationPrincipal Long userId) {
        return ApiResponse.ok(notificationService.getNotifications(userId));
    }

    @PutMapping("/{id}/read")
    @Operation(summary = "Mark a notification as read")
    public ApiResponse<Void> markAsRead(
            @AuthenticationPrincipal Long userId,
            @PathVariable("id") Long notificationId) {
        notificationService.markAsRead(userId, notificationId);
        return ApiResponse.ok("Notification marked as read", null);
    }
}
