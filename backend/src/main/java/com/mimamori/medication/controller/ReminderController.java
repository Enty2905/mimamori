package com.mimamori.medication.controller;

import com.mimamori.common.ApiResponse;
import com.mimamori.medication.dto.MedicationLogDto;
import com.mimamori.medication.service.MedicationService;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reminders")
public class ReminderController {
    private final MedicationService medications;
    public ReminderController(MedicationService medications) { this.medications = medications; }
    @GetMapping("/upcoming")
    public ApiResponse<List<MedicationLogDto>> upcoming(@AuthenticationPrincipal Long userId) {
        return ApiResponse.ok(medications.upcoming(userId));
    }
}
