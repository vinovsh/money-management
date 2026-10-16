package com.moneywise

import android.content.Context
import android.content.BroadcastReceiver
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import androidx.work.*
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.common.api.Scope
import com.google.android.gms.tasks.Tasks
import org.json.JSONObject
import org.json.JSONArray
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

object GoogleDailyBackup {
    const val TAG = "walletway-google-midnight"
    private const val FORMAT = "walletway-google-v1"
    private const val SCOPE = "https://www.googleapis.com/auth/drive.appdata"
    private const val LIMIT = 25 * 1024 * 1024
    private val lock = Any()
    fun prefs(c: Context) = c.getSharedPreferences("google-daily-backup", Context.MODE_PRIVATE)
    private fun iso(time: Long) = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date(time))
    private fun encode(s: String) = URLEncoder.encode(s, "UTF-8")
    private fun identity(c: Context, expected: String) = GoogleSignIn.getLastSignedInAccount(c)?.takeIf { it.id == expected && !it.email.isNullOrBlank() }
        ?: throw IllegalStateException("Open Walletway and reconnect your Google account.")
    private fun active(c: Context, expected: String) { if (prefs(c).getString("accountId", "") != expected) throw IllegalStateException("Google account changed. Reconnect before backing up."); identity(c, expected) }
    private fun access(c: Context, expected: String): String {
        active(c, expected)
        val user = identity(c, expected)
        val request = AuthorizationRequest.builder().setAccount(android.accounts.Account(user.email!!, "com.google"))
            .setRequestedScopes(listOf(Scope(SCOPE))).build()
        val result = Tasks.await(Identity.getAuthorizationClient(c).authorize(request), 60, TimeUnit.SECONDS)
        if (result.hasResolution() || result.accessToken.isNullOrBlank()) throw IllegalStateException("Open Walletway and reconnect Google to allow Drive backups.")
        return result.accessToken!!
    }
    private fun request(c: Context, account: String, token: String, url: String, method: String = "GET", body: ByteArray? = null, type: String = "application/json"): ByteArray {
        active(c, account)
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 30000; connection.readTimeout = 60000; connection.instanceFollowRedirects = false
        connection.requestMethod = method; connection.setRequestProperty("Authorization", "Bearer $token")
        try {
            if (body != null) { connection.doOutput = true; connection.setFixedLengthStreamingMode(body.size); connection.setRequestProperty("Content-Type", type); connection.outputStream.use { it.write(body) } }
            val code = connection.responseCode
            if (code == 401 || code == 403) throw IllegalStateException("Google backup permission expired. Reconnect Google and check Drive API access.")
            if (code !in 200..299) throw IOException("Google Drive is unavailable ($code). Your previous backup is kept.")
            return connection.inputStream.use { input ->
                val output = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
                while (true) { val count = input.read(buffer); if (count < 0) break; if (output.size() + count > LIMIT) throw IOException("Backup exceeds the 25 MB limit."); output.write(buffer, 0, count) }
                output.toByteArray()
            }
        } finally { connection.disconnect() }
    }
    private fun list(c: Context, account: String, token: String, currency: String): JSONArray {
        require(currency in listOf("USD", "INR", "EUR", "GBP", "AUD", "CAD"))
        val query = encode("trashed = false and appProperties has { key='format' and value='$FORMAT' } and appProperties has { key='currency' and value='$currency' }")
        val fields = encode("files(id,name,createdTime,size,appProperties)")
        val response = JSONObject(String(request(c, account, token, "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=$query&fields=$fields&orderBy=createdTime%20desc&pageSize=1"), Charsets.UTF_8))
        return response.optJSONArray("files") ?: JSONArray()
    }
    fun discover(c: Context, account: String, currency: String): String = synchronized(lock) { list(c, account, access(c, account), currency).toString() }
    fun configure(c: Context, account: String, email: String, db: String, currency: String) {
        val user = identity(c, account); require(user.email == email) { "Google account changed." }
        require(Regex("moneywise(?:-[A-Z]{3})?\\.db").matches(db)) { "Invalid ledger path" }
        require(currency in listOf("USD", "INR", "EUR", "GBP", "AUD", "CAD")) { "Unsupported currency" }
        val p = prefs(c)
        if (p.getString("accountId", "") != account) { WorkManager.getInstance(c).cancelAllWorkByTag(TAG); p.edit().clear().commit() }
        val ledgers = JSONObject(p.getString("ledgers", "{}")!!)
        ledgers.put(currency, db)
        check(p.edit().putString("accountId", account).putString("email", email).putString("ledgers", ledgers.toString()).commit())
        schedule(c)
    }
    fun accept(c: Context, currency: String, remote: String, timestamp: String) {
        val p = prefs(c); val editor = p.edit().putBoolean("ready-$currency", true).putString("remote-$currency", remote).remove("error"); if (timestamp.isNotEmpty()) editor.putString("last-$currency", timestamp); check(editor.commit()); schedule(c)
    }
    fun pause(c: Context, currency: String) { prefs(c).edit().putBoolean("ready-$currency", false).commit() }
    fun disconnect(c: Context) { prefs(c).edit().clear().commit(); WorkManager.getInstance(c).cancelAllWorkByTag(TAG); c.getSharedPreferences("drive-secrets", Context.MODE_PRIVATE).edit().clear().commit() }
    fun status(c: Context, currency: String): String {
        val p = prefs(c)
        return JSONObject().put("accountId", p.getString("accountId", "")).put("email", p.getString("email", ""))
            .put("registered", JSONObject(p.getString("ledgers", "{}")!!).has(currency)).put("ready", p.getBoolean("ready-$currency", false)).put("lastBackup", p.getString("last-$currency", ""))
            .put("error", p.getString("error", "")).put("nextBackup", if (p.contains("accountId")) iso(BackupSchedule.nextMidnight(System.currentTimeMillis(), TimeZone.getDefault())) else "").toString()
    }
    fun schedule(c: Context, reset: Boolean = false) {
        if (!prefs(c).contains("accountId")) return
        if (reset) WorkManager.getInstance(c).cancelAllWorkByTag(TAG)
        val now = System.currentTimeMillis(); val midnight = BackupSchedule.nextMidnight(now, TimeZone.getDefault())
        val day = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(midnight))
        val work = OneTimeWorkRequestBuilder<GoogleBackupWorker>().setInitialDelay(midnight - now, TimeUnit.MILLISECONDS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.MINUTES).addTag(TAG).build()
        WorkManager.getInstance(c).enqueueUniqueWork("$TAG-$day", ExistingWorkPolicy.KEEP, work)
    }
    fun snapshot(c: Context, dbName: String): JSONObject {
        require(Regex("moneywise(?:-[A-Z]{3})?\\.db").matches(dbName))
        val path = c.getDatabasePath(dbName); require(path.exists()) { "The ledger is no longer available." }
        val db = SQLiteDatabase.openDatabase(path.path, null, SQLiteDatabase.OPEN_READWRITE)
        val data = JSONObject(); val attachments = JSONObject()
        try {
            db.beginTransactionNonExclusive()
            try {
                for (table in listOf("accounts", "categories", "transactions", "budgets", "notes", "goals")) {
                    val rows = JSONArray(); db.rawQuery("SELECT payload FROM $table", null).use { cursor -> while (cursor.moveToNext()) rows.put(JSONObject(cursor.getString(0))) }; data.put(table, rows)
                }
                db.rawQuery("SELECT value FROM metadata WHERE key='settings'", null).use { cursor -> check(cursor.moveToFirst()); val settings = JSONObject(cursor.getString(0)); settings.remove("appLock"); settings.remove("adsEnabled"); data.put("settings", settings) }
                db.setTransactionSuccessful()
            } finally { db.endTransaction() }
        } finally { db.close() }
        var total = 0L
        val tx = data.getJSONArray("transactions")
        for (i in 0 until tx.length()) {
            val item = tx.getJSONObject(i); val receipt = item.optString("receipt", "")
            if (receipt.isNotEmpty() && item.isNull("deletedAt")) {
                val file = File(receipt).canonicalFile
                require(file.path.startsWith(c.filesDir.canonicalPath + File.separator)) { "Receipt must be in app-private storage." }
                require(file.exists() && file.length() <= 5 * 1024 * 1024) { "Receipt is missing or too large." }
                total += file.length(); require(total <= 12 * 1024 * 1024) { "Receipt attachments exceed the 12 MB backup limit." }
                attachments.put(item.getString("id"), android.util.Base64.encodeToString(file.readBytes(), android.util.Base64.NO_WRAP))
            }
        }
        return JSONObject().put("format", "moneywise-backup").put("version", 2).put("createdAt", iso(System.currentTimeMillis())).put("data", data).put("attachments", attachments)
    }
    fun perform(c: Context): String = synchronized(lock) {
        val p = prefs(c); val account = p.getString("accountId", "")!!; require(account.isNotEmpty()) { "Connect Google first." }
        val token = access(c, account); val ledgers = JSONObject(p.getString("ledgers", "{}")!!)
        var uploaded = 0
        for (currency in ledgers.keys()) {
            if (!p.getBoolean("ready-$currency", false)) continue
            val files = list(c, account, token, currency)
            val latest = (0 until files.length()).map { files.getJSONObject(it) }.firstOrNull { it.optJSONObject("appProperties")?.optString("currency") == currency }
            if ((latest?.optString("id") ?: "") != p.getString("remote-$currency", "")) {
                p.edit().putBoolean("ready-$currency", false).commit(); throw IllegalStateException("A newer $currency backup was found. Open Backup and restore it or keep this phone’s data.")
            }
            val snap = snapshot(c, ledgers.getString(currency)); require(snap.getJSONObject("data").getJSONObject("settings").getString("currency") == currency)
            // Local deletion pauses this ledger before clearing SQLite. Recheck after
            // capturing it so an in-flight job cannot upload a freshly emptied ledger.
            if (!p.getBoolean("ready-$currency", false)) continue
            val content = snap.toString(); val bytes = content.toByteArray(Charsets.UTF_8); require(bytes.size <= LIMIT) { "Backup exceeds the 25 MB limit." }
            val boundary = "walletway_${UUID.randomUUID()}"
            val metadata = JSONObject().put("name", "walletway-$currency-${System.currentTimeMillis()}.json").put("parents", JSONArray().put("appDataFolder"))
                .put("appProperties", JSONObject().put("format", FORMAT).put("currency", currency).put("datasetId", snap.getJSONObject("data").getJSONObject("settings").getString("datasetId")))
            val body = "--$boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n$metadata\r\n--$boundary\r\nContent-Type: application/json\r\n\r\n$content\r\n--$boundary--\r\n"
            val created = JSONObject(String(request(c, account, token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", "POST", body.toByteArray(Charsets.UTF_8), "multipart/related; boundary=$boundary"), Charsets.UTF_8)).getString("id")
            val verified = request(c, account, token, "https://www.googleapis.com/drive/v3/files/${encode(created)}?alt=media")
            check(bytes.contentEquals(verified)) { "Backup verification failed. Previous backups are kept." }
            active(c, account)
            check(p.edit().putString("remote-$currency", created).putString("last-$currency", snap.getString("createdAt")).remove("error").commit()); uploaded++
        }
        JSONObject().put("uploaded", uploaded).toString()
    }
}
class GoogleBackupWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        if (!GoogleDailyBackup.prefs(applicationContext).contains("accountId")) return Result.success()
        return try { GoogleDailyBackup.perform(applicationContext); GoogleDailyBackup.schedule(applicationContext); Result.success() }
        catch (e: Exception) {
            GoogleDailyBackup.prefs(applicationContext).edit().putString("error", e.message ?: "Google backup failed. Open the app to retry.").commit()
            if (e is IOException && runAttemptCount < 3) Result.retry() else { GoogleDailyBackup.schedule(applicationContext); Result.failure() }
        }
    }
}
class GoogleBackupTimeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) { GoogleDailyBackup.schedule(context, true) }
}
