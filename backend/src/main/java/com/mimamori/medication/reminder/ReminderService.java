package com.mimamori.medication.reminder;

import com.mimamori.medication.entity.*;
import com.mimamori.medication.repository.*;
import com.mimamori.notification.service.NotificationService;
import java.time.*;
import java.util.Date;
import org.quartz.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReminderService {
    private final MedicationRepository medications;
    private final MedicationLogRepository logs;
    private final Scheduler scheduler;
    private final NotificationService notifications;
    public ReminderService(MedicationRepository medications, MedicationLogRepository logs, Scheduler scheduler, NotificationService notifications) {
        this.medications = medications; this.logs = logs; this.scheduler = scheduler; this.notifications = notifications;
    }

    @Transactional
    public void materialize(Long medicationId) {
        Medication med = medications.findLockedById(medicationId).orElse(null);
        if (med == null || !Boolean.TRUE.equals(med.getIsActive())) return;
        LocalDate today = LocalDate.now(ZoneId.of(med.getTimeZone()));
        for (var schedule : med.getSchedules()) {
            if (!schedule.isActive()) continue;
            for (int day = -1; day <= 7; day++) {
                LocalDate date = today.plusDays(day);
                if (date.isBefore(med.getStartDate()) || med.getEndDate() != null && date.isAfter(med.getEndDate())) continue;
                String id = OccurrenceTimes.id(schedule.getId(), date, schedule.getReminderTime(), med.getTimeZone());
                var local = date.atTime(schedule.getReminderTime());
                MedicationLog log = logs.findByOccurrenceId(id).orElseGet(() -> logs.findByScheduleIdAndScheduledTime(schedule.getId(), local).orElse(null));
                if (log == null) {
                    log = new MedicationLog();
                    log.setOccurrenceId(id); log.setSchedule(schedule); log.setMedication(med); log.setElderly(med.getElderly());
                    log.setScheduledTime(local);
                    log.setScheduledAt(OccurrenceTimes.instant(date, schedule.getReminderTime(), med.getTimeZone()));
                    log = logs.saveAndFlush(log);
                }
                if (!log.isCanceled() && !log.isReminderSent() && log.getStatus() == MedicationStatus.PENDING
                        && log.getScheduledAt().isAfter(Instant.now().minusSeconds(7200))) schedule(log);
            }
        }
    }

    private void schedule(MedicationLog dose) {
        try {
            JobKey key = new JobKey(dose.getOccurrenceId(), "medication");
            if (scheduler.checkExists(key)) return;
            JobDetail job = JobBuilder.newJob(DoseReminderJob.class).withIdentity(key)
                    .usingJobData("occurrenceId", dose.getOccurrenceId()).requestRecovery().build();
            Trigger trigger = TriggerBuilder.newTrigger().withIdentity(dose.getOccurrenceId(), "medication")
                    .startAt(Date.from(dose.getScheduledAt().isBefore(Instant.now()) ? Instant.now() : dose.getScheduledAt()))
                    .withSchedule(SimpleScheduleBuilder.simpleSchedule().withMisfireHandlingInstructionFireNow()).build();
            scheduler.scheduleJob(job, trigger);
        } catch (ObjectAlreadyExistsException duplicate) {
            // Another node repaired the same deterministic job identity.
        } catch (SchedulerException failure) {
            throw new IllegalStateException("Persistent reminder scheduling failed", failure);
        }
    }

    @Transactional
    public void fire(String occurrenceId) {
        MedicationLog dose = logs.findLockedByOccurrenceId(occurrenceId).orElse(null);
        if (dose == null || dose.isCanceled() || dose.isReminderSent() || dose.getStatus() != MedicationStatus.PENDING
                || !Boolean.TRUE.equals(dose.getMedication().getIsActive())) return;
        if (dose.getScheduledAt().isAfter(Instant.now())) return;
        if (dose.getScheduledAt().isBefore(Instant.now().minusSeconds(7200))) return;
        notifications.sendOnce(dose.getElderly().getId(), "REMINDER", dose.getId(), "dose:" + occurrenceId);
        dose.setReminderSent(true);
    }

    public void cancelJob(String occurrenceId) {
        try { scheduler.deleteJob(new JobKey(occurrenceId, "medication")); }
        catch (SchedulerException failure) { throw new IllegalStateException("Reminder cancellation failed", failure); }
    }

    @Transactional
    public void cancelUnconfirmed(Long medicationId) {
        for (MedicationLog dose : logs.findByMedicationId(medicationId)) {
            if (dose.getStatus() == MedicationStatus.PENDING) {
                dose.setCanceled(true); cancelJob(dose.getOccurrenceId());
            }
        }
    }
}
