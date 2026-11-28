package com.mimamori.medication.service;

import com.mimamori.common.ApiException;
import com.mimamori.medication.dto.*;
import com.mimamori.medication.entity.*;
import com.mimamori.medication.repository.*;
import com.mimamori.medication.reminder.ReminderService;
import com.mimamori.userprofile.entity.*;
import com.mimamori.userprofile.repository.*;
import java.time.*;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class MedicationService {
    private final MedicationRepository medications;
    private final MedicationScheduleRepository schedules;
    private final MedicationLogRepository logs;
    private final UserRepository users;
    private final FamilyRelationshipRepository links;
    private final ReminderService reminders;
    public MedicationService(MedicationRepository medications, MedicationScheduleRepository schedules,
            MedicationLogRepository logs, UserRepository users, FamilyRelationshipRepository links, ReminderService reminders) {
        this.medications = medications; this.schedules = schedules; this.logs = logs;
        this.users = users; this.links = links; this.reminders = reminders;
    }

    public MedicationDto createMedication(Long userId, CreateMedicationRequest request) {
        validate(request);
        Long elderlyId = resolveElderlyId(userId, request.getElderlyId());
        User elderly = users.findById(elderlyId).orElseThrow();
        if (elderly.getRole() != UserRole.ELDERLY) throw new ApiException(400, "Medication requires an elderly user");
        Medication med = new Medication();
        med.setElderly(elderly);
        apply(med, request);
        medications.saveAndFlush(med);
        addSchedules(med, request);
        reminders.materialize(med.getId());
        return MedicationDto.fromEntity(med);
    }

    public MedicationDto updateMedication(Long userId, Long medicationId, CreateMedicationRequest request) {
        validate(request);
        Medication med = medications.findLockedById(medicationId).orElseThrow(() -> new ApiException(404, "Medication not found"));
        resolveElderlyId(userId, med.getElderly().getId());
        if (!Boolean.TRUE.equals(med.getIsActive())) throw new ApiException(409, "Medication is inactive");
        reminders.cancelUnconfirmed(medicationId);
        for (var schedule : med.getSchedules()) schedule.setActive(false);
        apply(med, request);
        addSchedules(med, request);
        reminders.materialize(medicationId);
        return MedicationDto.fromEntity(med);
    }

    private void apply(Medication med, CreateMedicationRequest request) {
        med.setName(request.getName().strip()); med.setDosage(request.getDosage().strip());
        med.setInstructions(request.getInstructions()); med.setStartDate(request.getStartDate());
        med.setEndDate(request.getEndDate()); med.setTimeZone(request.getTimeZone());
    }

    private void addSchedules(Medication med, CreateMedicationRequest request) {
        for (LocalTime time : request.getReminderTimes()) {
            var schedule = schedules.save(new MedicationSchedule(med, time, med.getDosage()));
            med.getSchedules().add(schedule);
        }
        schedules.flush();
    }

    private void validate(CreateMedicationRequest request) {
        try { ZoneId.of(request.getTimeZone()); }
        catch (RuntimeException error) { throw new ApiException(400, "Invalid time zone"); }
        if (request.getName() == null || request.getName().isBlank() || request.getName().length() > 100
                || request.getDosage() == null || request.getDosage().isBlank() || request.getDosage().length() > 50
                || request.getInstructions() != null && request.getInstructions().length() > 1000
                || request.getStartDate() == null || request.getEndDate() != null && request.getEndDate().isBefore(request.getStartDate())
                || request.getReminderTimes() == null || request.getReminderTimes().isEmpty() || request.getReminderTimes().size() > 8
                || request.getReminderTimes().contains(null)
                || request.getReminderTimes().stream().distinct().count() != request.getReminderTimes().size()) {
            throw new ApiException(400, "Invalid medication schedule");
        }
    }

    public List<MedicationDto> getMedications(Long userId, Long targetId) {
        return medications.findByElderlyIdAndIsActiveTrue(resolveElderlyId(userId, targetId)).stream().map(MedicationDto::fromEntity).toList();
    }

    public List<MedicationLogDto> getTodaySchedule(Long userId, Long targetId) {
        Long elderlyId = resolveElderlyId(userId, targetId);
        for (var med : medications.findByElderlyIdAndIsActiveTrue(elderlyId)) reminders.materialize(med.getId());
        ZoneId zone = ZoneId.of(users.findById(elderlyId).orElseThrow().getTimeZone());
        LocalDate today = LocalDate.now(zone);
        return logs.findByElderlyIdAndScheduledAtBetweenOrderByScheduledAt(elderlyId, today.atStartOfDay(zone).toInstant(), today.plusDays(1).atStartOfDay(zone).toInstant().minusNanos(1))
                .stream().filter(dose -> !dose.isCanceled()).map(MedicationLogDto::fromEntity).toList();
    }

    public List<MedicationLogDto> upcoming(Long userId) {
        User user = users.findById(userId).orElseThrow(() -> new ApiException(401, "Invalid session"));
        if (user.getRole() != UserRole.ELDERLY) return List.of();
        for (var med : medications.findByElderlyIdAndIsActiveTrue(userId)) reminders.materialize(med.getId());
        return logs.findByElderlyIdAndScheduledAtBetweenOrderByScheduledAt(userId, Instant.now().minusSeconds(86400), Instant.now().plusSeconds(7 * 86400))
                .stream().filter(dose -> !dose.isCanceled() && dose.getStatus() != MedicationStatus.TAKEN && dose.getStatus() != MedicationStatus.SKIPPED)
                .map(MedicationLogDto::fromEntity).toList();
    }

    public MedicationLogDto confirmMedication(Long userId, Long logId, ConfirmMedicationRequest request) {
        MedicationLog dose = logs.findLockedById(logId).orElseThrow(() -> new ApiException(404, "Dose not found"));
        resolveElderlyId(userId, dose.getElderly().getId());
        MedicationStatus status = request.getStatus();
        if (status != MedicationStatus.TAKEN && status != MedicationStatus.SKIPPED) throw new ApiException(400, "Only TAKEN or SKIPPED may be confirmed");
        if (dose.getStatus() == status) return MedicationLogDto.fromEntity(dose);
        if (dose.getStatus() == MedicationStatus.TAKEN || dose.getStatus() == MedicationStatus.SKIPPED || dose.isCanceled()) throw new ApiException(409, "Dose already confirmed or canceled");
        Instant confirmed = request.getConfirmedAt() == null ? Instant.now() : request.getConfirmedAt();
        confirmed = confirmed.truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        if (confirmed.isAfter(Instant.now().plusSeconds(60)) || confirmed.isBefore(dose.getScheduledAt().minusSeconds(86400))
                || request.getNotes() != null && request.getNotes().length() > 1000) throw new ApiException(400, "Invalid confirmation");
        dose.setStatus(status); dose.setConfirmedAt(confirmed);
        dose.setTakenTime(status == MedicationStatus.TAKEN ? LocalDateTime.ofInstant(confirmed, ZoneId.of(dose.getMedication().getTimeZone())) : null);
        dose.setNotes(request.getNotes());
        reminders.cancelJob(dose.getOccurrenceId());
        return MedicationLogDto.fromEntity(dose);
    }

    public List<MedicationLogDto> getHistory(Long userId, Long targetId) {
        return logs.findByElderlyIdOrderByScheduledTimeDesc(resolveElderlyId(userId, targetId)).stream().filter(dose -> !dose.isCanceled()).limit(50).map(MedicationLogDto::fromEntity).toList();
    }

    public MedicationLogDto getDose(Long userId, Long id) {
        var dose = logs.findById(id).orElseThrow(() -> new ApiException(404, "Dose not found"));
        resolveElderlyId(userId, dose.getElderly().getId());
        if (dose.isCanceled()) throw new ApiException(409, "Dose canceled");
        return MedicationLogDto.fromEntity(dose);
    }

    public void deleteMedication(Long userId, Long medicationId) {
        Medication med = medications.findLockedById(medicationId).orElseThrow(() -> new ApiException(404, "Medication not found"));
        resolveElderlyId(userId, med.getElderly().getId());
        med.setIsActive(false);
        reminders.cancelUnconfirmed(medicationId);
    }

    private Long resolveElderlyId(Long userId, Long targetId) {
        User user = users.findById(userId).orElseThrow(() -> new ApiException(401, "Invalid session"));
        if (user.getRole() == UserRole.ELDERLY) {
            if (targetId != null && !targetId.equals(userId)) throw new ApiException(403, "Not authorized");
            return userId;
        }
        if (targetId == null) {
            var active = links.findByCaregiverId(userId).stream().filter(link -> link.getStatus() == RelationshipStatus.ACCEPTED).toList();
            if (active.size() != 1) throw new ApiException(400, "Select an elderly family member");
            targetId = active.getFirst().getElderly().getId();
        }
        if (!links.existsByCaregiverIdAndElderlyId(userId, targetId)) throw new ApiException(403, "Not authorized for this family member");
        return targetId;
    }
}
