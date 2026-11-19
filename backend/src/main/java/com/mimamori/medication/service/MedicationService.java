package com.mimamori.medication.service;

import com.mimamori.common.ApiException;
import com.mimamori.medication.dto.ConfirmMedicationRequest;
import com.mimamori.medication.dto.CreateMedicationRequest;
import com.mimamori.medication.dto.MedicationDto;
import com.mimamori.medication.dto.MedicationLogDto;
import com.mimamori.medication.entity.Medication;
import com.mimamori.medication.entity.MedicationLog;
import com.mimamori.medication.entity.MedicationSchedule;
import com.mimamori.medication.entity.MedicationStatus;
import com.mimamori.medication.repository.MedicationLogRepository;
import com.mimamori.medication.repository.MedicationRepository;
import com.mimamori.medication.repository.MedicationScheduleRepository;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.entity.UserRole;
import com.mimamori.userprofile.repository.FamilyRelationshipRepository;
import com.mimamori.userprofile.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class MedicationService {

    private final MedicationRepository medicationRepository;
    private final MedicationScheduleRepository scheduleRepository;
    private final MedicationLogRepository logRepository;
    private final UserRepository userRepository;
    private final FamilyRelationshipRepository relationshipRepository;

    public MedicationService(
            MedicationRepository medicationRepository,
            MedicationScheduleRepository scheduleRepository,
            MedicationLogRepository logRepository,
            UserRepository userRepository,
            FamilyRelationshipRepository relationshipRepository) {
        this.medicationRepository = medicationRepository;
        this.scheduleRepository = scheduleRepository;
        this.logRepository = logRepository;
        this.userRepository = userRepository;
        this.relationshipRepository = relationshipRepository;
    }

    @Transactional
    public MedicationDto createMedication(Long currentUserId, CreateMedicationRequest request) {
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ApiException(404, "User not found"));

        User targetElderly;
        if (currentUser.getRole() == UserRole.ELDERLY) {
            targetElderly = currentUser;
        } else {
            if (request.getElderlyId() == null) {
                throw new ApiException(400, "Elderly ID is required when creating medication as a caregiver");
            }
            if (!relationshipRepository.existsByCaregiverIdAndElderlyId(currentUserId, request.getElderlyId())) {
                throw new ApiException(403, "You do not have permission to manage medication for this elderly user");
            }
            targetElderly = userRepository.findById(request.getElderlyId())
                    .orElseThrow(() -> new ApiException(404, "Target elderly user not found"));
        }

        Medication medication = new Medication();
        medication.setElderly(targetElderly);
        medication.setName(request.getName());
        medication.setDosage(request.getDosage());
        medication.setInstructions(request.getInstructions());
        medication.setStartDate(request.getStartDate());
        medication.setEndDate(request.getEndDate());
        medication.setIsActive(true);

        medication = medicationRepository.save(medication);

        List<MedicationSchedule> schedules = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (LocalTime time : request.getReminderTimes()) {
            MedicationSchedule schedule = new MedicationSchedule(medication, time, request.getDosage());
            schedule = scheduleRepository.save(schedule);
            schedules.add(schedule);

            // Generate initial log for today if within date range
            if (!today.isBefore(request.getStartDate()) && (request.getEndDate() == null || !today.isAfter(request.getEndDate()))) {
                LocalDateTime scheduledTime = LocalDateTime.of(today, time);
                MedicationLog log = new MedicationLog();
                log.setSchedule(schedule);
                log.setMedication(medication);
                log.setElderly(targetElderly);
                log.setScheduledTime(scheduledTime);
                log.setStatus(MedicationStatus.PENDING);
                logRepository.save(log);
            }
        }

        medication.setSchedules(schedules);
        return MedicationDto.fromEntity(medication);
    }

    public List<MedicationDto> getMedications(Long currentUserId, Long targetElderlyId) {
        Long elderlyId = resolveElderlyId(currentUserId, targetElderlyId);
        return medicationRepository.findByElderlyIdAndIsActiveTrue(elderlyId)
                .stream()
                .map(MedicationDto::fromEntity)
                .collect(Collectors.toList());
    }

    public List<MedicationLogDto> getTodaySchedule(Long currentUserId, Long targetElderlyId) {
        Long elderlyId = resolveElderlyId(currentUserId, targetElderlyId);
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = LocalDate.now().atTime(LocalTime.MAX);

        List<MedicationLog> logs = logRepository.findByElderlyIdAndScheduledTimeBetweenOrderByScheduledTimeAsc(
                elderlyId, startOfDay, endOfDay);

        // Auto-mark overdue pending medication logs as MISSED if more than 2 hours passed
        LocalDateTime now = LocalDateTime.now();
        for (MedicationLog log : logs) {
            if (log.getStatus() == MedicationStatus.PENDING && log.getScheduledTime().plusHours(2).isBefore(now)) {
                log.setStatus(MedicationStatus.MISSED);
                logRepository.save(log);
            }
        }

        return logs.stream().map(MedicationLogDto::fromEntity).collect(Collectors.toList());
    }

    @Transactional
    public MedicationLogDto confirmMedication(Long currentUserId, Long logId, ConfirmMedicationRequest request) {
        MedicationLog log = logRepository.findById(logId)
                .orElseThrow(() -> new ApiException(404, "Medication log not found"));

        if (!log.getElderly().getId().equals(currentUserId)) {
            // Also allow linked caregiver to confirm on behalf if needed
            if (!relationshipRepository.existsByCaregiverIdAndElderlyId(currentUserId, log.getElderly().getId())) {
                throw new ApiException(403, "You do not have permission to confirm this medication");
            }
        }

        log.setStatus(request.getStatus() != null ? request.getStatus() : MedicationStatus.TAKEN);
        log.setTakenTime(LocalDateTime.now());
        if (request.getNotes() != null) {
            log.setNotes(request.getNotes());
        }

        log = logRepository.save(log);
        return MedicationLogDto.fromEntity(log);
    }

    public List<MedicationLogDto> getHistory(Long currentUserId, Long targetElderlyId) {
        Long elderlyId = resolveElderlyId(currentUserId, targetElderlyId);
        return logRepository.findByElderlyIdOrderByScheduledTimeDesc(elderlyId)
                .stream()
                .limit(50)
                .map(MedicationLogDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public MedicationDto updateMedication(Long currentUserId, Long medicationId, CreateMedicationRequest request) {
        Medication medication = medicationRepository.findById(medicationId)
                .orElseThrow(() -> new ApiException(404, "Medication not found"));

        User elderly = medication.getElderly();
        Long elderlyId = elderly.getId();
        if (!elderlyId.equals(currentUserId) && !relationshipRepository.existsByCaregiverIdAndElderlyId(currentUserId, elderlyId)) {
            throw new ApiException(403, "You do not have permission to update this medication");
        }

        medication.setName(request.getName());
        medication.setDosage(request.getDosage());
        medication.setInstructions(request.getInstructions());
        medication.setStartDate(request.getStartDate());
        medication.setEndDate(request.getEndDate());

        LocalDate today = LocalDate.now();
        logRepository.deletePendingLogsFrom(medicationId, today.atStartOfDay());
        logRepository.clearScheduleLinks(medicationId);

        medication.getSchedules().clear();
        medication = medicationRepository.saveAndFlush(medication);

        for (LocalTime time : request.getReminderTimes()) {
            MedicationSchedule schedule = new MedicationSchedule(medication, time, request.getDosage());
            schedule = scheduleRepository.save(schedule);
            medication.getSchedules().add(schedule);

            if (!today.isBefore(request.getStartDate()) && (request.getEndDate() == null || !today.isAfter(request.getEndDate()))) {
                LocalDateTime scheduledTime = LocalDateTime.of(today, time);
                MedicationLog log = new MedicationLog();
                log.setSchedule(schedule);
                log.setMedication(medication);
                log.setElderly(elderly);
                log.setScheduledTime(scheduledTime);
                log.setStatus(MedicationStatus.PENDING);
                logRepository.save(log);
            }
        }

        medication = medicationRepository.save(medication);
        return MedicationDto.fromEntity(medication);
    }

    @Transactional
    public void deleteMedication(Long currentUserId, Long medicationId) {
        Medication medication = medicationRepository.findById(medicationId)
                .orElseThrow(() -> new ApiException(404, "Medication not found"));

        Long elderlyId = medication.getElderly().getId();
        if (!elderlyId.equals(currentUserId) && !relationshipRepository.existsByCaregiverIdAndElderlyId(currentUserId, elderlyId)) {
            throw new ApiException(403, "You do not have permission to delete this medication");
        }

        medication.setIsActive(false);
        medicationRepository.save(medication);
        logRepository.deletePendingLogsFrom(medicationId, LocalDate.now().atStartOfDay());
    }

    private Long resolveElderlyId(Long currentUserId, Long targetElderlyId) {
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ApiException(404, "User not found"));
        if (currentUser.getRole() == UserRole.ELDERLY) {
            return currentUserId;
        }
        if (targetElderlyId != null) {
            if (!relationshipRepository.existsByCaregiverIdAndElderlyId(currentUserId, targetElderlyId)) {
                throw new ApiException(403, "You are not authorized to view this elderly member's data");
            }
            return targetElderlyId;
        }
        return relationshipRepository.findByCaregiverId(currentUserId)
                .stream()
                .findFirst()
                .map(rel -> rel.getElderly().getId())
                .orElse(currentUserId);
    }
}
