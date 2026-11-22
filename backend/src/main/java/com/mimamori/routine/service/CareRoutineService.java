package com.mimamori.routine.service;

import com.mimamori.common.ApiException;
import com.mimamori.conversation.entity.DailyCheckIn;
import com.mimamori.conversation.repository.DailyCheckInRepository;
import com.mimamori.notification.service.NotificationService;
import com.mimamori.routine.dto.CareRoutineConfigRequest;
import com.mimamori.routine.dto.CareRoutineLogDto;
import com.mimamori.routine.dto.ConfirmCareRoutineRequest;
import com.mimamori.routine.dto.DailyRoutineOverviewDto;
import com.mimamori.routine.entity.CareRoutine;
import com.mimamori.routine.entity.CareRoutineLog;
import com.mimamori.routine.repository.CareRoutineLogRepository;
import com.mimamori.routine.repository.CareRoutineRepository;
import com.mimamori.userprofile.entity.RelationshipStatus;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.entity.UserRole;
import com.mimamori.userprofile.repository.FamilyRelationshipRepository;
import com.mimamori.userprofile.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class CareRoutineService {

    public static final String TYPE_WATER = "WATER";
    public static final String TYPE_SLEEP = "SLEEP";
    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_COMPLETED = "COMPLETED";
    public static final String STATUS_SKIPPED = "SKIPPED";

    private static final DateTimeFormatter INPUT_TIME_FMT = DateTimeFormatter.ofPattern("H:mm");
    private static final DateTimeFormatter OUTPUT_TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final CareRoutineRepository routineRepository;
    private final CareRoutineLogRepository logRepository;
    private final UserRepository userRepository;
    private final FamilyRelationshipRepository relationshipRepository;
    private final DailyCheckInRepository checkInRepository;
    private final NotificationService notificationService;

    public CareRoutineService(
            CareRoutineRepository routineRepository,
            CareRoutineLogRepository logRepository,
            UserRepository userRepository,
            FamilyRelationshipRepository relationshipRepository,
            DailyCheckInRepository checkInRepository,
            NotificationService notificationService) {
        this.routineRepository = routineRepository;
        this.logRepository = logRepository;
        this.userRepository = userRepository;
        this.relationshipRepository = relationshipRepository;
        this.checkInRepository = checkInRepository;
        this.notificationService = notificationService;
    }

    public DailyRoutineOverviewDto getTodayRoutine(Long currentUserId, Long targetElderlyId) {
        Long elderlyId = resolveElderlyId(currentUserId, targetElderlyId);
        return getTodayRoutineForElderly(elderlyId);
    }

    public DailyRoutineOverviewDto getTodayRoutineForElderly(Long elderlyId) {
        User elderly = userRepository.findById(elderlyId)
                .orElseThrow(() -> new ApiException(404, "Elderly user not found"));
        CareRoutine routine = getOrCreateRoutine(elderly);
        LocalDate today = LocalDate.now();
        List<CareRoutineLog> logs = ensureTodayLogs(routine, elderly, today);
        return buildOverview(routine, elderlyId, today, logs);
    }

    public DailyRoutineOverviewDto updateConfig(Long currentUserId, Long targetElderlyId, CareRoutineConfigRequest request) {
        if (request == null) {
            throw new ApiException(400, "Routine configuration payload is required");
        }
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ApiException(404, "User not found"));
        Long elderlyId = resolveElderlyId(currentUser, targetElderlyId);
        User elderly = elderlyId.equals(currentUserId)
                ? currentUser
                : userRepository.findById(elderlyId)
                        .orElseThrow(() -> new ApiException(404, "Elderly user not found"));

        CareRoutine routine = getOrCreateRoutine(elderly);

        int effectiveCupMl = routine.getWaterCupMl() != null ? routine.getWaterCupMl() : 200;
        if (request.getWaterCupMl() != null) {
            int cupMl = request.getWaterCupMl();
            if (cupMl < 50 || cupMl > 1000) {
                throw new ApiException(400, "waterCupMl must be between 50 and 1000");
            }
            effectiveCupMl = cupMl;
            routine.setWaterCupMl(cupMl);
        }

        if (request.getWaterTargetMl() != null) {
            int targetMl = request.getWaterTargetMl();
            if (targetMl < 600 || targetMl > 4000) {
                throw new ApiException(400, "waterTargetMl must be between 600 and 4000");
            }
            routine.setWaterTargetMl(targetMl);
            int derivedCups = Math.max(1, (int) Math.ceil((double) targetMl / effectiveCupMl));
            routine.setWaterTargetCups(derivedCups);
        } else if (request.getWaterTargetCups() != null) {
            int cups = request.getWaterTargetCups();
            if (cups < 1 || cups > 30) {
                throw new ApiException(400, "waterTargetCups must be between 1 and 30");
            }
            routine.setWaterTargetCups(cups);
            routine.setWaterTargetMl(cups * effectiveCupMl);
        } else if (request.getWaterCupMl() != null) {
            int existingTargetMl = routine.getWaterTargetMl() != null ? routine.getWaterTargetMl() : 1400;
            routine.setWaterTargetCups(Math.max(1, (int) Math.ceil((double) existingTargetMl / effectiveCupMl)));
        }

        if (request.getWaterReminderTimes() != null) {
            List<String> normalizedTimes = normalizeAndSortTimes(request.getWaterReminderTimes());
            String joined = String.join(",", normalizedTimes);
            if (joined.length() > 255) {
                throw new ApiException(400, "Too many water reminder times");
            }
            routine.setWaterReminderTimes(joined);
        }

        if (request.getBedtimeTime() != null) {
            routine.setBedtimeTime(normalizeTime(request.getBedtimeTime(), "bedtimeTime"));
        }

        if (request.getWakeupTime() != null) {
            routine.setWakeupTime(normalizeTime(request.getWakeupTime(), "wakeupTime"));
        }

        if (request.getSleepTargetHours() != null) {
            double hours = request.getSleepTargetHours();
            if (hours <= 0 || hours > 24.0) {
                throw new ApiException(400, "sleepTargetHours must be between 0 and 24");
            }
            routine.setSleepTargetHours(hours);
        }

        if (request.getWaterEnabled() != null) {
            routine.setWaterEnabled(request.getWaterEnabled());
        }

        if (request.getSleepEnabled() != null) {
            routine.setSleepEnabled(request.getSleepEnabled());
        }

        routine.setConfiguredBy(currentUser);
        routine = routineRepository.save(routine);

        LocalDate today = LocalDate.now();
        List<CareRoutineLog> logs = reconcileTodayLogs(routine, elderly, today);
        return buildOverview(routine, elderlyId, today, logs);
    }

    public DailyRoutineOverviewDto confirmLog(Long currentUserId, Long logId, ConfirmCareRoutineRequest request) {
        CareRoutineLog log = logRepository.findById(logId)
                .orElseThrow(() -> new ApiException(404, "Routine log not found"));

        User elderly = log.getElderly();
        Long elderlyId = elderly.getId();
        if (!elderlyId.equals(currentUserId)
                && !relationshipRepository.existsByCaregiverIdAndElderlyId(currentUserId, elderlyId)) {
            throw new ApiException(403, "You do not have permission to confirm this routine log");
        }

        String nextStatus = STATUS_COMPLETED;
        if (request != null && request.getStatus() != null && !request.getStatus().isBlank()) {
            String candidate = request.getStatus().trim().toUpperCase(Locale.ROOT);
            if (!STATUS_COMPLETED.equals(candidate) && !STATUS_SKIPPED.equals(candidate)) {
                throw new ApiException(400, "Status must be COMPLETED or SKIPPED");
            }
            nextStatus = candidate;
        }

        log.setStatus(nextStatus);
        if (STATUS_COMPLETED.equals(nextStatus)) {
            log.setCompletedAt(LocalDateTime.now());
        } else {
            log.setCompletedAt(null);
        }
        if (request != null && request.getNote() != null) {
            log.setNote(request.getNote().trim());
        }

        log = logRepository.save(log);

        CareRoutine routine = getOrCreateRoutine(elderly);
        LocalDate routineDate = log.getRoutineDate();
        List<CareRoutineLog> logs = logRepository
                .findByElderlyIdAndRoutineDateOrderByScheduledTimeAsc(elderlyId, routineDate);

        if (STATUS_COMPLETED.equals(nextStatus)) {
            notifyCaregivers(elderly, currentUserId, log, routine, logs);
        }

        return buildOverview(routine, elderlyId, routineDate, logs);
    }

    public DailyRoutineOverviewDto quickAddWater(
            Long currentUserId, Long targetElderlyId, ConfirmCareRoutineRequest request) {
        Long elderlyId = resolveElderlyId(currentUserId, targetElderlyId);
        User elderly = userRepository.findById(elderlyId)
                .orElseThrow(() -> new ApiException(404, "Elderly user not found"));
        CareRoutine routine = getOrCreateRoutine(elderly);
        LocalDate today = LocalDate.now();

        List<CareRoutineLog> existingLogs = ensureTodayLogs(routine, elderly, today);
        int nextExtraIndex = nextExtraWaterIndex(existingLogs);

        CareRoutineLog extraLog = new CareRoutineLog();
        extraLog.setElderly(elderly);
        extraLog.setRoutineDate(today);
        extraLog.setRoutineType(TYPE_WATER);
        extraLog.setScheduledTime("EXTRA-" + nextExtraIndex);
        extraLog.setStatus(STATUS_COMPLETED);
        extraLog.setCompletedAt(LocalDateTime.now());
        String note = request != null && request.getNote() != null && !request.getNote().isBlank()
                ? request.getNote().trim()
                : "Uống thêm 1 cốc nước";
        extraLog.setNote(note);

        extraLog = logRepository.save(extraLog);
        List<CareRoutineLog> updatedLogs = new ArrayList<>(existingLogs);
        updatedLogs.add(extraLog);
        updatedLogs.sort(Comparator.comparing(CareRoutineLog::getScheduledTime));

        notifyCaregivers(elderly, currentUserId, extraLog, routine, updatedLogs);

        return buildOverview(routine, elderlyId, today, updatedLogs);
    }

    private CareRoutine getOrCreateRoutine(User elderly) {
        return routineRepository.findByElderlyId(elderly.getId())
                .orElseGet(() -> {
                    CareRoutine created = new CareRoutine();
                    created.setElderly(elderly);
                    return routineRepository.save(created);
                });
    }

    private List<CareRoutineLog> ensureTodayLogs(CareRoutine routine, User elderly, LocalDate today) {
        List<CareRoutineLog> existing = logRepository
                .findByElderlyIdAndRoutineDateOrderByScheduledTimeAsc(elderly.getId(), today);

        List<CareRoutineLog> toCreate = collectMissingSlots(routine, elderly, today, existing);
        if (!toCreate.isEmpty()) {
            logRepository.saveAll(toCreate);
            return logRepository.findByElderlyIdAndRoutineDateOrderByScheduledTimeAsc(elderly.getId(), today);
        }
        return existing;
    }

    private List<CareRoutineLog> reconcileTodayLogs(CareRoutine routine, User elderly, LocalDate today) {
        List<CareRoutineLog> existing = logRepository
                .findByElderlyIdAndRoutineDateOrderByScheduledTimeAsc(elderly.getId(), today);

        Set<String> desiredWater = Boolean.TRUE.equals(routine.getWaterEnabled())
                ? new LinkedHashSet<>(parseReminderTimes(routine.getWaterReminderTimes()))
                : Set.of();
        Set<String> desiredSleep = Boolean.TRUE.equals(routine.getSleepEnabled())
                ? Set.of(routine.getBedtimeTime())
                : Set.of();

        List<CareRoutineLog> toDelete = new ArrayList<>();
        for (CareRoutineLog log : existing) {
            if (!STATUS_PENDING.equals(log.getStatus())) {
                continue;
            }
            if (TYPE_WATER.equals(log.getRoutineType()) && !desiredWater.contains(log.getScheduledTime())) {
                toDelete.add(log);
            } else if (TYPE_SLEEP.equals(log.getRoutineType()) && !desiredSleep.contains(log.getScheduledTime())) {
                toDelete.add(log);
            }
        }

        if (!toDelete.isEmpty()) {
            logRepository.deleteAll(toDelete);
            logRepository.flush();
            existing = existing.stream()
                    .filter(l -> !toDelete.contains(l))
                    .collect(Collectors.toList());
        }

        List<CareRoutineLog> toCreate = collectMissingSlots(routine, elderly, today, existing);
        if (!toCreate.isEmpty()) {
            logRepository.saveAll(toCreate);
        }

        return logRepository.findByElderlyIdAndRoutineDateOrderByScheduledTimeAsc(elderly.getId(), today);
    }

    private List<CareRoutineLog> collectMissingSlots(
            CareRoutine routine, User elderly, LocalDate today, List<CareRoutineLog> existing) {
        Set<String> existingKeys = existing.stream()
                .map(l -> l.getRoutineType() + "|" + l.getScheduledTime())
                .collect(Collectors.toSet());

        List<CareRoutineLog> toCreate = new ArrayList<>();

        if (Boolean.TRUE.equals(routine.getWaterEnabled())) {
            for (String time : parseReminderTimes(routine.getWaterReminderTimes())) {
                String key = TYPE_WATER + "|" + time;
                if (!existingKeys.contains(key)) {
                    CareRoutineLog slot = new CareRoutineLog();
                    slot.setElderly(elderly);
                    slot.setRoutineDate(today);
                    slot.setRoutineType(TYPE_WATER);
                    slot.setScheduledTime(time);
                    slot.setStatus(STATUS_PENDING);
                    toCreate.add(slot);
                    existingKeys.add(key);
                }
            }
        }

        if (Boolean.TRUE.equals(routine.getSleepEnabled())) {
            String bedtime = routine.getBedtimeTime();
            String key = TYPE_SLEEP + "|" + bedtime;
            if (!existingKeys.contains(key)) {
                CareRoutineLog slot = new CareRoutineLog();
                slot.setElderly(elderly);
                slot.setRoutineDate(today);
                slot.setRoutineType(TYPE_SLEEP);
                slot.setScheduledTime(bedtime);
                slot.setStatus(STATUS_PENDING);
                toCreate.add(slot);
                existingKeys.add(key);
            }
        }

        return toCreate;
    }

    private DailyRoutineOverviewDto buildOverview(
            CareRoutine routine, Long elderlyId, LocalDate date, List<CareRoutineLog> logs) {
        DailyRoutineOverviewDto dto = new DailyRoutineOverviewDto();
        dto.setElderlyId(elderlyId);

        int cupMl = routine.getWaterCupMl() != null ? routine.getWaterCupMl() : 200;
        int targetMl = routine.getWaterTargetMl() != null ? routine.getWaterTargetMl() : 1400;
        int targetCups = routine.getWaterTargetCups() != null
                ? routine.getWaterTargetCups()
                : Math.max(1, (int) Math.ceil((double) targetMl / cupMl));
        int completedCups = (int) logs.stream()
                .filter(l -> TYPE_WATER.equals(l.getRoutineType()) && STATUS_COMPLETED.equals(l.getStatus()))
                .count();
        HydrationAssessment assessment = evaluateHydration(completedCups, targetCups, targetMl, cupMl);

        dto.setWaterTargetCups(targetCups);
        dto.setWaterCompletedCups(completedCups);
        dto.setWaterTargetMl(targetMl);
        dto.setWaterCupMl(cupMl);
        dto.setWaterCompletedMl(assessment.completedMl);
        dto.setHydrationPercent(assessment.percent);
        dto.setHydrationStatus(assessment.status);
        dto.setHydrationEvaluationText(assessment.evaluationText);
        dto.setWaterReminderTimes(parseReminderTimes(routine.getWaterReminderTimes()));
        dto.setWaterEnabled(Boolean.TRUE.equals(routine.getWaterEnabled()));
        dto.setBedtimeTime(routine.getBedtimeTime());
        dto.setWakeupTime(routine.getWakeupTime());
        dto.setSleepTargetHours(routine.getSleepTargetHours() != null ? routine.getSleepTargetHours() : 8.0);
        dto.setSleepEnabled(Boolean.TRUE.equals(routine.getSleepEnabled()));

        // Determine sleepStatus & sleepCompletedAt
        CareRoutineLog activeBedtimeLog = logs.stream()
                .filter(l -> TYPE_SLEEP.equals(l.getRoutineType())
                        && Objects.equals(l.getScheduledTime(), routine.getBedtimeTime()))
                .findFirst()
                .orElse(null);

        if (activeBedtimeLog != null) {
            if (STATUS_COMPLETED.equals(activeBedtimeLog.getStatus())) {
                dto.setSleepStatus(STATUS_COMPLETED);
                dto.setSleepCompletedAt(activeBedtimeLog.getCompletedAt());
            } else {
                dto.setSleepStatus(STATUS_PENDING);
                dto.setSleepCompletedAt(null);
            }
        } else {
            CareRoutineLog anyCompletedSleep = logs.stream()
                    .filter(l -> TYPE_SLEEP.equals(l.getRoutineType()) && STATUS_COMPLETED.equals(l.getStatus()))
                    .findFirst()
                    .orElse(null);
            if (anyCompletedSleep != null) {
                dto.setSleepStatus(STATUS_COMPLETED);
                dto.setSleepCompletedAt(anyCompletedSleep.getCompletedAt());
            } else {
                dto.setSleepStatus(STATUS_PENDING);
                dto.setSleepCompletedAt(null);
            }
        }

        String sleepQuality = checkInRepository.findByElderlyIdAndCheckinDate(elderlyId, date)
                .map(DailyCheckIn::getSleepQuality)
                .orElse(null);
        dto.setLastNightSleepQuality(sleepQuality);

        dto.setLogs(logs.stream()
                .map(CareRoutineLogDto::fromEntity)
                .collect(Collectors.toList()));

        return dto;
    }

    private void notifyCaregivers(
            User elderly,
            Long actorUserId,
            CareRoutineLog log,
            CareRoutine routine,
            List<CareRoutineLog> allTodayLogs) {
        if (notificationService == null) {
            return;
        }
        String elderlyName = elderly.getFullName();
        String title;
        String body;
        if (TYPE_WATER.equals(log.getRoutineType())) {
            int completed = (int) allTodayLogs.stream()
                    .filter(l -> TYPE_WATER.equals(l.getRoutineType()) && STATUS_COMPLETED.equals(l.getStatus()))
                    .count();
            int cupMl = routine.getWaterCupMl() != null ? routine.getWaterCupMl() : 200;
            int targetMl = routine.getWaterTargetMl() != null ? routine.getWaterTargetMl() : 1400;
            int target = routine.getWaterTargetCups() != null
                    ? routine.getWaterTargetCups()
                    : Math.max(1, (int) Math.ceil((double) targetMl / cupMl));
            HydrationAssessment assessment = evaluateHydration(completed, target, targetMl, cupMl);
            title = "Đã uống nước: " + elderlyName;
            body = String.format(Locale.US,
                    "Bác %s vừa xác nhận uống 1 ly %dml (%s/%sL • %d/%d ly). Đánh giá: %s.",
                    elderlyName,
                    cupMl,
                    formatLiters(assessment.completedMl),
                    formatLiters(targetMl),
                    completed,
                    target,
                    assessment.shortSummary);
        } else {
            title = "Đã đi ngủ: " + elderlyName;
            body = String.format("Bác %s vừa xác nhận đã đi ngủ (lịch %s).",
                    elderlyName, log.getScheduledTime());
        }

        relationshipRepository.findByElderlyId(elderly.getId()).stream()
                .filter(rel -> rel.getStatus() != RelationshipStatus.REJECTED)
                .map(rel -> rel.getCaregiver().getId())
                .filter(caregiverId -> !caregiverId.equals(actorUserId))
                .distinct()
                .forEach(caregiverId -> notificationService.sendNotification(
                        caregiverId, title, body, "REMINDER", log.getId()));
    }

    private int nextExtraWaterIndex(List<CareRoutineLog> existingLogs) {
        int max = 0;
        for (CareRoutineLog log : existingLogs) {
            if (TYPE_WATER.equals(log.getRoutineType())
                    && log.getScheduledTime() != null
                    && log.getScheduledTime().startsWith("EXTRA-")) {
                try {
                    int n = Integer.parseInt(log.getScheduledTime().substring("EXTRA-".length()));
                    if (n > max) {
                        max = n;
                    }
                } catch (NumberFormatException ignored) {
                    // Ignore non-numeric extra suffix
                }
            }
        }
        return max + 1;
    }

    private List<String> parseReminderTimes(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        List<String> parts = Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
        return normalizeAndSortTimes(parts);
    }

    private List<String> normalizeAndSortTimes(List<String> rawTimes) {
        TreeSet<String> sorted = new TreeSet<>();
        for (String item : rawTimes) {
            if (item == null || item.isBlank()) {
                continue;
            }
            sorted.add(normalizeTime(item, "waterReminderTimes"));
        }
        return new ArrayList<>(sorted);
    }

    private String normalizeTime(String rawTime, String fieldName) {
        if (rawTime == null || rawTime.isBlank()) {
            throw new ApiException(400, fieldName + " must be in HH:mm format");
        }
        try {
            LocalTime parsed = LocalTime.parse(rawTime.trim(), INPUT_TIME_FMT);
            return parsed.format(OUTPUT_TIME_FMT);
        } catch (DateTimeParseException ex) {
            throw new ApiException(400, "Invalid time format for " + fieldName + ": " + rawTime + " (expected HH:mm)");
        }
    }

    private Long resolveElderlyId(Long currentUserId, Long targetElderlyId) {
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ApiException(404, "User not found"));
        return resolveElderlyId(currentUser, targetElderlyId);
    }

    private Long resolveElderlyId(User currentUser, Long targetElderlyId) {
        if (currentUser.getRole() == UserRole.ELDERLY) {
            if (targetElderlyId != null && !targetElderlyId.equals(currentUser.getId())) {
                throw new ApiException(403, "You are not authorized to access another elderly member's routine");
            }
            return currentUser.getId();
        }
        if (targetElderlyId != null) {
            if (!relationshipRepository.existsByCaregiverIdAndElderlyId(currentUser.getId(), targetElderlyId)) {
                throw new ApiException(403, "You are not authorized to access this elderly member's routine");
            }
            return targetElderlyId;
        }
        return relationshipRepository.findByCaregiverId(currentUser.getId())
                .stream()
                .findFirst()
                .map(rel -> rel.getElderly().getId())
                .orElseThrow(() -> new ApiException(400, "Elderly ID is required"));
    }

    private HydrationAssessment evaluateHydration(int completedCups, int targetCups, int targetMl, int cupMl) {
        int safeCupMl = Math.max(50, cupMl);
        int safeTargetMl = Math.max(600, targetMl);
        int completedMl = Math.max(0, completedCups) * safeCupMl;
        int percent = Math.min(100, (int) Math.round((completedMl * 100.0) / safeTargetMl));

        String completedL = formatLiters(completedMl);
        String targetL = formatLiters(safeTargetMl);

        if (completedMl >= safeTargetMl) {
            return new HydrationAssessment(
                    completedMl,
                    percent,
                    "TARGET_ACHIEVED",
                    String.format("Đạt mục tiêu ngày (%s/%s L)", completedL, targetL),
                    "Đạt mục tiêu nước lọc trong ngày");
        }
        if (completedMl >= 1300) {
            return new HydrationAssessment(
                    completedMl,
                    percent,
                    "MINIMUM_MET",
                    String.format("Đạt tối thiểu 1.3L+ nước lọc (%s/%s L)", completedL, targetL),
                    "Đã đạt mức nước lọc tối thiểu 1.3L+");
        }
        if (percent >= 50) {
            return new HydrationAssessment(
                    completedMl,
                    percent,
                    "PROGRESSING",
                    String.format("Đang bổ sung tốt (%s/%s L)", completedL, targetL),
                    String.format("Đang uống tốt (%d%% mục tiêu)", percent));
        }
        if (completedMl > 0) {
            return new HydrationAssessment(
                    completedMl,
                    percent,
                    "NEEDS_MORE",
                    String.format("Cần uống thêm nước lọc (%s/%s L)", completedL, targetL),
                    "Cần nhắc uống thêm nước lọc");
        }
        return new HydrationAssessment(
                0,
                0,
                "NEEDS_MORE",
                String.format("Chưa uống nước hôm nay (Mục tiêu %s L)", targetL),
                "Chưa ghi nhận ly nước nào hôm nay");
    }

    private String formatLiters(int ml) {
        if (ml <= 0) {
            return "0";
        }
        double liters = ml / 1000.0;
        if (ml % 100 == 0) {
            return String.format(Locale.US, "%.1f", liters);
        }
        return String.format(Locale.US, "%.2f", liters);
    }

    private static final class HydrationAssessment {
        final int completedMl;
        final int percent;
        final String status;
        final String evaluationText;
        final String shortSummary;

        HydrationAssessment(
                int completedMl, int percent, String status, String evaluationText, String shortSummary) {
            this.completedMl = completedMl;
            this.percent = percent;
            this.status = status;
            this.evaluationText = evaluationText;
            this.shortSummary = shortSummary;
        }
    }
}
