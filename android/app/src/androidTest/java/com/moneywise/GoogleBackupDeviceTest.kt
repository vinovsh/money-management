package com.moneywise

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.work.WorkInfo
import androidx.work.WorkManager
import org.json.JSONObject
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import java.io.File
import java.util.TimeZone
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class GoogleBackupDeviceTest {
    private val context: Context = ApplicationProvider.getApplicationContext()
    private val name = "moneywise-CAD.db"
    private val receipt get() = File(context.filesDir, "backup-test-receipt.jpg")
    @Before fun setup() {
        context.deleteDatabase(name); GoogleDailyBackup.disconnect(context)
        val db = context.openOrCreateDatabase(name, Context.MODE_PRIVATE, null)
        db.execSQL("CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        for (table in listOf("accounts", "categories", "transactions", "budgets", "notes", "goals")) db.execSQL("CREATE TABLE $table (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
        val settings = JSONObject().put("currency", "CAD").put("datasetId", "native-test").put("name", "Test").put("onboarding", true).put("lastBackup", "").put("appLock", true).put("adsEnabled", false)
        db.execSQL("INSERT INTO metadata VALUES ('settings', ?)", arrayOf(settings.toString()))
        receipt.writeText("receipt-data")
        val item = JSONObject().put("id", "expense").put("amount", 100).put("deletedAt", JSONObject.NULL).put("receipt", receipt.path)
        db.execSQL("INSERT INTO transactions VALUES ('expense', ?)", arrayOf(item.toString())); db.close()
    }
    @After fun cleanup() { context.deleteDatabase(name); receipt.delete(); GoogleDailyBackup.disconnect(context) }
    @Test fun nativeSnapshotsIncludeReceiptsAndExcludeDeviceSecrets() {
        val snap = GoogleDailyBackup.snapshot(context, name)
        assertEquals("moneywise-backup", snap.getString("format")); assertEquals(2, snap.getInt("version"))
        val settings = snap.getJSONObject("data").getJSONObject("settings")
        assertEquals("CAD", settings.getString("currency")); assertFalse(settings.has("appLock")); assertFalse(settings.has("adsEnabled"))
        assertEquals(1, snap.getJSONObject("data").getJSONArray("transactions").length())
        assertEquals("receipt-data", String(android.util.Base64.decode(snap.getJSONObject("attachments").getString("expense"), android.util.Base64.DEFAULT)))
    }
    @Test fun missingReceiptsFailWithoutChangingTheLedger() {
        receipt.delete()
        try { GoogleDailyBackup.snapshot(context, name); fail("Missing receipt must fail") } catch (e: IllegalArgumentException) { assertTrue(e.message!!.contains("Receipt")) }
        SQLiteDatabase.openDatabase(context.getDatabasePath(name).path, null, SQLiteDatabase.OPEN_READONLY).use { db -> db.rawQuery("SELECT COUNT(*) FROM transactions", null).use { c -> c.moveToFirst(); assertEquals(1, c.getInt(0)) } }
    }
    @Test fun databasePathsAreConfinedToLedgers() {
        try { GoogleDailyBackup.snapshot(context, "../../secret.db"); fail("Invalid path must fail") } catch (_: IllegalArgumentException) {}
    }
    @Test fun midnightWorkIsPersistentAndDisconnectCancelsIt() {
        GoogleDailyBackup.prefs(context).edit().putString("accountId", "test-account").commit()
        GoogleDailyBackup.schedule(context)
        val jobs = WorkManager.getInstance(context).getWorkInfosByTag(GoogleDailyBackup.TAG).get(10, TimeUnit.SECONDS)
        val job = jobs.first { it.state == WorkInfo.State.ENQUEUED }
        val expected = BackupSchedule.nextMidnight(System.currentTimeMillis(), TimeZone.getDefault())
        assertTrue(kotlin.math.abs(expected - job.nextScheduleTimeMillis) < 10000)
        GoogleDailyBackup.disconnect(context)
        assertFalse(GoogleDailyBackup.prefs(context).contains("accountId"))
        WorkManager.getInstance(context).cancelAllWorkByTag(GoogleDailyBackup.TAG).result.get(10, TimeUnit.SECONDS)
        assertTrue(WorkManager.getInstance(context).getWorkInfosByTag(GoogleDailyBackup.TAG).get(10, TimeUnit.SECONDS).none { it.state == WorkInfo.State.ENQUEUED })
    }
}
