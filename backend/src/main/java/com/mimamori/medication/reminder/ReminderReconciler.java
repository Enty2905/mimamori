package com.mimamori.medication.reminder;

import com.mimamori.medication.repository.MedicationRepository;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.context.event.EventListener;
import org.springframework.boot.context.event.ApplicationReadyEvent;

@Component
public class ReminderReconciler {
    private final MedicationRepository medications;
    private final ReminderService reminders;
    public ReminderReconciler(MedicationRepository medications, ReminderService reminders) {
        this.medications = medications; this.reminders = reminders;
    }
    @EventListener(ApplicationReadyEvent.class)
    public void startup() { reconcile(); }
    @Scheduled(fixedDelay = 60000, initialDelay = 60000)
    public void reconcile() {
        for (var med : medications.findByIsActiveTrue()) {
            try { reminders.materialize(med.getId()); }
            catch (RuntimeException error) {
                org.slf4j.LoggerFactory.getLogger(getClass()).warn("Reminder reconciliation failed for medication {} ({})", med.getId(), error.getClass().getSimpleName());
            }
        }
    }
}
