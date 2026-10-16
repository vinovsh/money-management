package com.moneywise;
import org.junit.Test;
import static org.junit.Assert.*;
import java.time.*;
import java.util.TimeZone;
public class BackupScheduleTest {
    private long next(String instant, String zone) {
        return BackupSchedule.nextMidnight(Instant.parse(instant).toEpochMilli(), TimeZone.getTimeZone(zone));
    }
    @Test public void indiaMidnightUsesPhoneTime() { assertEquals(Instant.parse("2026-10-16T18:30:00Z").toEpochMilli(), next("2026-10-16T11:00:00Z", "Asia/Kolkata")); }
    @Test public void alreadyAtMidnightSchedulesTomorrow() { assertEquals(Instant.parse("2026-10-17T00:00:00Z").toEpochMilli(), next("2026-10-16T00:00:00Z", "UTC")); }
    @Test public void springDstDayHas23Hours() { assertEquals(23L*60*60*1000, next("2026-03-29T00:00:00Z", "Europe/London")-Instant.parse("2026-03-29T00:00:00Z").toEpochMilli()); }
    @Test public void autumnDstDayHas25Hours() { assertEquals(25L*60*60*1000, next("2026-10-24T23:00:00Z", "Europe/London")-Instant.parse("2026-10-24T23:00:00Z").toEpochMilli()); }
    @Test public void timezoneChangeRecomputesLocalMidnight() { assertNotEquals(next("2026-10-16T11:00:00Z", "UTC"),next("2026-10-16T11:00:00Z", "Asia/Kolkata")); }
}
