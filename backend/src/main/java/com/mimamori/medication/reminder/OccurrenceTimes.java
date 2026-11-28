package com.mimamori.medication.reminder;

import java.time.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

public final class OccurrenceTimes {
    private OccurrenceTimes() {}
    /** At DST gaps use the next valid local instant; at overlaps use the earlier offset once. */
    public static Instant instant(LocalDate date, LocalTime time, String zone) {
        return ZonedDateTime.of(date, time, ZoneId.of(zone)).toInstant();
    }
    public static String id(long scheduleId, LocalDate date, LocalTime time, String zone) {
        return UUID.nameUUIDFromBytes((scheduleId + ":" + date + ":" + time + ":" + zone).getBytes(StandardCharsets.UTF_8)).toString();
    }
}
