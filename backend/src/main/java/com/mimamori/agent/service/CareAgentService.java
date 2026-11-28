package com.mimamori.agent.service;

import com.mimamori.agent.entity.DailySummary;
import com.mimamori.agent.repository.DailySummaryRepository;
import com.mimamori.conversation.entity.DailyCheckIn;
import com.mimamori.conversation.repository.DailyCheckInRepository;
import com.mimamori.medication.entity.MedicationLog;
import com.mimamori.medication.entity.MedicationStatus;
import com.mimamori.medication.repository.MedicationLogRepository;
import com.mimamori.notification.entity.AlertSeverity;
import com.mimamori.notification.entity.AlertType;
import com.mimamori.notification.service.AlertService;
import com.mimamori.userprofile.entity.User;
import com.mimamori.userprofile.entity.UserRole;
import com.mimamori.userprofile.repository.UserRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Service
public class CareAgentService {

    private final com.mimamori.medication.repository.MedicationRepository medications;
    private final com.mimamori.medication.reminder.ReminderService reminders;
    private final UserRepository userRepository;
    private final MedicationLogRepository logRepository;
    private final DailyCheckInRepository checkInRepository;
    private final AlertService alertService;
    private final DailySummaryRepository summaryRepository;

    public CareAgentService(
            UserRepository userRepository,
            MedicationLogRepository logRepository,
            DailyCheckInRepository checkInRepository,
            AlertService alertService,
            DailySummaryRepository summaryRepository,
            com.mimamori.medication.repository.MedicationRepository medications,
            com.mimamori.medication.reminder.ReminderService reminders) {
        this.medications=medications;this.reminders=reminders;
        this.userRepository = userRepository;
        this.logRepository = logRepository;
        this.checkInRepository = checkInRepository;
        this.alertService = alertService;
        this.summaryRepository = summaryRepository;
    }

    /**
     * Periodic Rule-Based Care Agent Evaluation
     * Runs every 15 minutes to evaluate conditions for each elderly user.
     */
    @Scheduled(fixedRate = 900000) // 15 mins
    @Transactional
    public void evaluateAllElderlyUsers() {
        List<User> elderlyList = userRepository.findByRole(UserRole.ELDERLY);
        for (User elderly : elderlyList) {
            evaluateElderly(elderly.getId());
        }
    }

    @Transactional
    public String evaluateElderly(Long elderlyId) {
        User elderly = userRepository.findById(elderlyId).orElse(null);
        if (elderly == null) return "NORMAL";

        java.time.ZoneId zone = java.time.ZoneId.of(elderly.getTimeZone());
        LocalDate today = LocalDate.now(zone);
        LocalDateTime now = LocalDateTime.now(zone);

        for(var med:medications.findByElderlyIdAndIsActiveTrue(elderlyId))reminders.materialize(med.getId());

        // 1. OBSERVE & ANALYZE: Missed Medications
        LocalDateTime startOfDay = today.atStartOfDay();
        List<MedicationLog> todayLogs = logRepository.findByElderlyIdAndScheduledAtBetweenOrderByScheduledAt(
                elderlyId, today.atStartOfDay(zone).toInstant(), today.plusDays(1).atStartOfDay(zone).toInstant().minusNanos(1)).stream().filter(log -> !log.isCanceled()).toList();

        int missedCount = 0;
        int takenCount = 0;
        for (MedicationLog candidate : todayLogs) {
            MedicationLog log = logRepository.findLockedById(candidate.getId()).orElseThrow();
            if (log.getStatus() == MedicationStatus.MISSED) {
                missedCount++;
            } else if (log.getStatus() == MedicationStatus.TAKEN) {
                takenCount++;
            } else if (log.getStatus() == MedicationStatus.PENDING && log.getScheduledAt().plusSeconds(3600).isBefore(java.time.Instant.now())) {
                // If more than 1 hour overdue, mark as MISSED and generate alert
                log.setStatus(MedicationStatus.MISSED);
                logRepository.save(log);
                missedCount++;

                alertService.createAlert(
                        elderlyId,
                        AlertType.MISSED_MEDICATION,
                        AlertSeverity.HIGH,
                        String.format("Bác %s chưa xác nhận uống thuốc '%s' lịch %s.",
                                elderly.getFullName(), log.getMedication().getName(), log.getScheduledTime().toLocalTime()),
                        "MISSED_DOSE:" + log.getId()
                );
            }
        }

        // 2. OBSERVE & ANALYZE: Daily Check-in
        DailyCheckIn checkIn = checkInRepository.findByElderlyIdAndCheckinDate(elderlyId, today).orElse(null);
        boolean checkinConcerning = false;

        if (checkIn == null) {
            // If it's past 18:00 (evening) and no check-in yet, generate reminder alert
            if (now.getHour() >= 18) {
                alertService.createAlert(
                        elderlyId,
                        AlertType.MISSED_CHECKIN,
                        AlertSeverity.MEDIUM,
                        String.format("Bác %s hôm nay chưa hoàn thành khảo sát sức khỏe Daily Check-in.", elderly.getFullName()), "MISSED_CHECKIN:" + today
                );
            }
        } else {
            if (Boolean.TRUE.equals(checkIn.getConcerningFlag())) {
                checkinConcerning = true;
                alertService.createAlert(
                        elderlyId,
                        AlertType.CHECKIN_CONCERN,
                        AlertSeverity.HIGH,
                        String.format("Bác %s ghi nhận dấu hiệu sức khỏe cần chú ý hôm nay: %s.",
                                elderly.getFullName(), "Cần liên hệ để kiểm tra"), "CHECKIN:" + today
                );
            }
        }

        // 3. DECIDE: Classification
        String status = todayLogs.isEmpty() && checkIn == null ? "UNKNOWN" : "NORMAL";
        if (missedCount > 0 || checkinConcerning) {
            status = "NEEDS_ATTENTION";
        } else if (checkIn == null && now.getHour() >= 14) {
            status = "REMINDER_REQUIRED";
        }

        // 4. ACT: Generate or update Daily Summary
        Double adherenceRate = todayLogs.isEmpty() ? null : (double) takenCount / todayLogs.size();
        DailySummary summary = summaryRepository.findByElderlyIdAndSummaryDate(elderlyId, today)
                .orElse(new DailySummary());

        summary.setElderly(elderly);
        summary.setSummaryDate(today);
        summary.setMedicationAdherenceRate(adherenceRate);
        summary.setCheckinSummary(checkIn != null ? checkIn.getAiAnalysisSummary() : "Chưa hoàn thành điểm danh hôm nay");
        summary.setAlertCount(missedCount + (checkinConcerning ? 1 : 0));
        summary.setAiHealthNote(status.equals("UNKNOWN") ? "Chưa có dữ liệu để đánh giá hôm nay." : status.equals("NORMAL") ?
                "Chưa có tín hiệu cảnh báo theo dữ liệu đã ghi nhận." :
                "Có dữ liệu cần gia đình kiểm tra và liên hệ trực tiếp.");

        summaryRepository.save(summary);

        return status;
    }
}

