package com.mimamori.medication.reminder;

import org.quartz.*;
import org.springframework.beans.factory.annotation.Autowired;

@DisallowConcurrentExecution
public class DoseReminderJob implements Job {
    @Autowired private ReminderService reminders;
    @Override
    public void execute(JobExecutionContext context) throws JobExecutionException {
        try { reminders.fire(context.getMergedJobDataMap().getString("occurrenceId")); }
        catch (RuntimeException error) { throw new JobExecutionException("Reminder will be repaired by reconciliation", error, false); }
    }
}
