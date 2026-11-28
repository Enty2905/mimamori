package com.mimamori.agent.service;

import com.mimamori.agent.dto.DailySummaryDto;
import com.mimamori.agent.dto.DashboardOverviewDto;
import com.mimamori.agent.repository.DailySummaryRepository;
import com.mimamori.common.ApiException;
import com.mimamori.conversation.dto.DailyCheckInDto;
import com.mimamori.conversation.repository.DailyCheckInRepository;
import com.mimamori.medication.dto.MedicationLogDto;
import com.mimamori.medication.service.MedicationService;
import com.mimamori.notification.dto.CareAlertDto;
import com.mimamori.notification.service.AlertService;
import com.mimamori.routine.service.CareRoutineService;
import com.mimamori.userprofile.dto.UserDto;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.entity.UserRole;
import com.mimamori.userprofile.repository.FamilyRelationshipRepository;
import com.mimamori.userprofile.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class DashboardService {

    private final UserRepository userRepository;
    private final FamilyRelationshipRepository relationshipRepository;
    private final MedicationService medicationService;
    private final DailyCheckInRepository checkInRepository;
    private final AlertService alertService;
    private final DailySummaryRepository summaryRepository;
    private final CareAgentService careAgentService;
    private final CareRoutineService careRoutineService;

    public DashboardService(
            UserRepository userRepository,
            FamilyRelationshipRepository relationshipRepository,
            MedicationService medicationService,
            DailyCheckInRepository checkInRepository,
            AlertService alertService,
            DailySummaryRepository summaryRepository,
            CareAgentService careAgentService) {
        this(userRepository, relationshipRepository, medicationService, checkInRepository,
                alertService, summaryRepository, careAgentService, null);
    }

    @Autowired
    public DashboardService(
            UserRepository userRepository,
            FamilyRelationshipRepository relationshipRepository,
            MedicationService medicationService,
            DailyCheckInRepository checkInRepository,
            AlertService alertService,
            DailySummaryRepository summaryRepository,
            CareAgentService careAgentService,
            @Autowired(required = false) CareRoutineService careRoutineService) {
        this.userRepository = userRepository;
        this.relationshipRepository = relationshipRepository;
        this.medicationService = medicationService;
        this.checkInRepository = checkInRepository;
        this.alertService = alertService;
        this.summaryRepository = summaryRepository;
        this.careAgentService = careAgentService;
        this.careRoutineService = careRoutineService;
    }

    @Transactional
    public DashboardOverviewDto getOverview(Long currentUserId, Long targetElderlyId) {
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ApiException(404, "User not found"));

        Long elderlyId;
        if (currentUser.getRole() == UserRole.ELDERLY) {
            elderlyId = currentUserId;
        } else {
            if (targetElderlyId != null) {
                if (!relationshipRepository.existsByCaregiverIdAndElderlyId(currentUserId, targetElderlyId)) {
                    throw new ApiException(403, "Not authorized to view this elderly member's dashboard");
                }
                elderlyId = targetElderlyId;
            } else {
                // Default to first linked elderly
                elderlyId = relationshipRepository.findByCaregiverId(currentUserId)
                        .stream()
                        .filter(link -> link.getStatus() == com.mimamori.userprofile.entity.RelationshipStatus.ACCEPTED)
                        .findFirst()
                        .map(rel -> rel.getElderly().getId())
                        .orElse(null);

                if (elderlyId == null) {
                    DashboardOverviewDto empty = new DashboardOverviewDto();
                    empty.setCareStatus("UNKNOWN");
                    return empty;
                }
            }
        }

        User elderly = userRepository.findById(elderlyId)
                .orElseThrow(() -> new ApiException(404, "Elderly user not found"));

        // Evaluate state
        String careStatus = careAgentService.evaluateElderly(elderlyId);

        DashboardOverviewDto dto = new DashboardOverviewDto();
        dto.setElderly(UserDto.fromEntity(elderly));
        dto.setCareStatus(careStatus);

        // Checkin
        checkInRepository.findByElderlyIdAndCheckinDate(elderlyId, LocalDate.now(java.time.ZoneId.of(elderly.getTimeZone())))
                .ifPresent(c -> dto.setTodayCheckIn(DailyCheckInDto.fromEntity(c)));

        // Medications
        List<MedicationLogDto> todayMeds = medicationService.getTodaySchedule(elderlyId, elderlyId);
        dto.setTodayMedications(todayMeds);

        long takenCount = todayMeds.stream().filter(m -> "TAKEN".equalsIgnoreCase(m.getStatus().name())).count();
        dto.setMedicationAdherence(todayMeds.isEmpty() ? null : Math.round((double) takenCount / todayMeds.size() * 100.0) / 100.0);

        // Alerts
        List<CareAlertDto> alerts = alertService.getAlerts(currentUserId).stream()
                .filter(a -> a.getElderlyId().equals(elderlyId) && !Boolean.TRUE.equals(a.getIsResolved()))
                .limit(5)
                .collect(Collectors.toList());
        dto.setActiveAlerts(alerts);

        // Summary
        summaryRepository.findByElderlyIdAndSummaryDate(elderlyId, LocalDate.now(java.time.ZoneId.of(elderly.getTimeZone())))
                .ifPresent(s -> dto.setRecentSummary(DailySummaryDto.fromEntity(s)));

        // Care Routine (Water & Sleep)
        if (careRoutineService != null) {
            dto.setTodayRoutine(careRoutineService.getTodayRoutineForElderly(elderlyId));
        }

        return dto;
    }
}
