package com.mimamori;

import com.mimamori.medication.reminder.OccurrenceTimes;
import java.time.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class OccurrenceTimesTest {
    @Test void dstGapMovesForwardAndOverlapUsesOneEarlierInstant() {
        assertEquals(Instant.parse("2026-03-08T07:30:00Z"), OccurrenceTimes.instant(LocalDate.of(2026,3,8), LocalTime.of(2,30), "America/New_York"));
        assertEquals(Instant.parse("2026-11-01T05:30:00Z"), OccurrenceTimes.instant(LocalDate.of(2026,11,1), LocalTime.of(1,30), "America/New_York"));
    }
    @Test void identitiesAreStableButChangeWithTimeZoneOrTime() {
        LocalDate day = LocalDate.of(2026,11,8);
        String id = OccurrenceTimes.id(2,day,LocalTime.NOON,"Asia/Tokyo");
        assertEquals(id, OccurrenceTimes.id(2,day,LocalTime.NOON,"Asia/Tokyo"));
        assertNotEquals(id, OccurrenceTimes.id(2,day,LocalTime.NOON,"Asia/Ho_Chi_Minh"));
    }
}
