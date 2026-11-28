package com.mimamori.userprofile.controller;

import com.mimamori.common.ApiResponse;
import com.mimamori.userprofile.dto.FamilyMemberDto;
import com.mimamori.userprofile.dto.LinkFamilyRequest;
import com.mimamori.userprofile.service.FamilyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/family")
@Tag(name = "Family Linking", description = "Endpoints for linking Caregiver with Elderly users")
public class FamilyController {

    private final FamilyService familyService;

    public FamilyController(FamilyService familyService) {
        this.familyService = familyService;
    }

    @PostMapping("/link")
    @Operation(summary = "Link a caregiver with an elderly member by username")
    public ApiResponse<FamilyMemberDto> linkElderly(
            @AuthenticationPrincipal Long caregiverId,
            @Valid @RequestBody LinkFamilyRequest request) {
        return ApiResponse.ok("Family relationship established", familyService.linkElderly(caregiverId, request));
    }

    @GetMapping("/members")
    @Operation(summary = "List linked family members for current user")
    public ApiResponse<List<FamilyMemberDto>> getFamilyMembers(@AuthenticationPrincipal Long userId) {
        return ApiResponse.ok(familyService.getFamilyMembers(userId));
    }

    @DeleteMapping("/link/{id}")
    @Operation(summary = "Remove a family relationship")
    public ApiResponse<Void> removeLink(
            @AuthenticationPrincipal Long userId,
            @PathVariable("id") Long relationshipId) {
        familyService.removeFamilyLink(userId, relationshipId);
        return ApiResponse.ok("Family relationship removed", null);
    }

    @PutMapping("/link/{id}/accept")
    public ApiResponse<FamilyMemberDto> accept(@AuthenticationPrincipal Long userId, @PathVariable("id") Long id) {
        return ApiResponse.ok(familyService.accept(userId,id));
    }
}
