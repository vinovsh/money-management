package com.moneywise;
import java.util.Calendar;
import java.util.TimeZone;
public final class BackupSchedule {
    private BackupSchedule() {}
    public static long nextMidnight(long now, TimeZone zone) {
        Calendar next = Calendar.getInstance(zone);
        next.setTimeInMillis(now);
        next.add(Calendar.DAY_OF_MONTH, 1);
        next.set(Calendar.HOUR_OF_DAY, 0);
        next.set(Calendar.MINUTE, 0);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        return next.getTimeInMillis();
    }
}
