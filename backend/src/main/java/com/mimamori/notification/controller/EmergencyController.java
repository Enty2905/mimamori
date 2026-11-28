package com.mimamori.notification.controller;

import com.mimamori.common.ApiException;
import com.mimamori.common.ApiResponse;
import com.mimamori.notification.entity.AlertSeverity;
import com.mimamori.notification.entity.AlertType;
import com.mimamori.notification.service.AlertService;
import com.mimamori.userprofile.entity.RelationshipStatus;
import com.mimamori.userprofile.entity.UserRole;
import com.mimamori.userprofile.repository.FamilyRelationshipRepository;
import com.mimamori.userprofile.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/emergencies")
public class EmergencyController {
    private final com.mimamori.notification.service.EmergencyService emergencies;
    public EmergencyController(com.mimamori.notification.service.EmergencyService emergencies) {
        this.emergencies = emergencies;
    }
    public record EmergencyRequest(@NotNull UUID requestId) {}

    @PostMapping
    public ApiResponse<com.mimamori.notification.service.EmergencyService.Receipt> create(@AuthenticationPrincipal Long userId, @Valid @RequestBody EmergencyRequest request) {
        return ApiResponse.ok(emergencies.create(userId, request.requestId()));
    }
}
