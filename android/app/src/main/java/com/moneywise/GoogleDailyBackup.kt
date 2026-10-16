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
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

object GoogleDailyBackup {
    const val TAG = "walletway-google-midnight"
    private const val FORMAT = "walletway-google-sync-v1"
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
    private val http = OkHttpClient.Builder().connectTimeout(30, TimeUnit.SECONDS).readTimeout(60, TimeUnit.SECONDS).callTimeout(90, TimeUnit.SECONDS).followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false).build()
    private fun request(c: Context, account: String, token: String, url: String, method: String = "GET", body: ByteArray? = null, type: String = "application/json", etag: String = "", headers: MutableMap<String,String>? = null): ByteArray {
        active(c, account)
        val builder = Request.Builder().url(url).header("Authorization", "Bearer $token")
        if (etag.isNotEmpty()) builder.header("If-Match", etag)
        builder.method(method, body?.toRequestBody(type.toMediaType()))
        http.newCall(builder.build()).execute().use { response ->
            if (response.code == 401 || response.code == 403) throw IllegalStateException("Reconnect Google to allow account sync.")
            if (response.code == 412) throw IllegalStateException("Google data changed on another device. Reconnect to restore the latest data.")
            if (!response.isSuccessful) throw IOException("Google sync is unavailable (${response.code}). Phone data is unchanged.")
            response.header("ETag")?.let { headers?.put("etag", it) }
            if (response.code == 204) return ByteArray(0)
            return response.body!!.byteStream().use { input ->
                val output = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
                while (true) { val count = input.read(buffer); if (count < 0) break; if (output.size() + count > LIMIT) throw IOException("Sync data exceeds the 25 MB limit."); output.write(buffer, 0, count) }
                output.toByteArray()
            }
        }
    }
    private fun ownedFiles(c: Context, account: String, token: String): List<JSONObject> {
        val query = encode("trashed = false and (appProperties has { key='format' and value='$FORMAT' } or appProperties has { key='format' and value='walletway-google-v1' } or appProperties has { key='format' and value='moneywise-v1' })")
        val fields = encode("nextPageToken,files(id,name,createdTime,modifiedTime,version,size,appProperties)")
        val files = mutableListOf<JSONObject>(); var page = ""
        do {
            val suffix = if (page.isEmpty()) "" else "&pageToken=${encode(page)}"
            val response = JSONObject(String(request(c, account, token, "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=$query&fields=$fields&orderBy=modifiedTime%20desc&pageSize=100$suffix"), Charsets.UTF_8))
            val batch = response.optJSONArray("files") ?: JSONArray(); for (i in 0 until batch.length()) files.add(batch.getJSONObject(i))
            page = response.optString("nextPageToken", "")
        } while (page.isNotEmpty())
        return files
    }
    private fun metadata(c: Context, account: String, token: String, id: String, headers: MutableMap<String,String>? = null): JSONObject = JSONObject(String(request(c, account, token, "https://www.googleapis.com/drive/v3/files/${encode(id)}?fields=id,version,modifiedTime", headers = headers), Charsets.UTF_8))
    private fun download(c: Context, account: String, token: String, id: String): JSONObject = JSONObject(String(request(c, account, token, "https://www.googleapis.com/drive/v3/files/${encode(id)}?alt=media"), Charsets.UTF_8))
    private fun cloud(c: Context, account: String, token: String): JSONObject {
        val files = ownedFiles(c, account, token)
        val canonical = files.filter { it.getJSONObject("appProperties").optString("format") == FORMAT }.minByOrNull { it.optString("createdTime") + it.getString("id") }
        val sources = JSONObject(); val entries = JSONObject(); val legacy = JSONArray(); val encryptedIds = mutableSetOf<String>()
        var activeCurrency = ""; var timestamp = ""; var canonicalVersion = ""; var canonicalTag = ""
        for (file in files) {
            val id = file.getString("id"); val headers = mutableMapOf<String,String>()
            val before = metadata(c, account, token, id, headers)
            val value = download(c, account, token, id)
            val after = metadata(c, account, token, id)
            check(before.getString("version") == after.getString("version")) { "Google data changed while downloading. Reconnect to retry." }
            sources.put(id, after.getString("version"))
            val format = file.getJSONObject("appProperties").getString("format")
            if (format == FORMAT) {
                require(value.optString("format") == "walletway-google-sync" && value.optInt("version") == 1) { "Unsupported Google sync data. Update the app." }
                val remote = value.getJSONObject("ledgers")
                for (currency in remote.keys()) if (!entries.has(currency)) entries.put(currency, remote.getJSONObject(currency))
                val old = value.optJSONArray("legacyArchives") ?: JSONArray()
                for (i in 0 until old.length()) { val archive = old.getJSONObject(i); if (encryptedIds.add(archive.getString("sourceId"))) legacy.put(archive) }
                if (activeCurrency.isEmpty()) activeCurrency = value.optString("activeCurrency")
                if (timestamp.isEmpty()) timestamp = value.optString("updatedAt")
                if (canonical?.getString("id") == id) { canonicalVersion = after.getString("version"); canonicalTag = headers["etag"] ?: "" }
            } else if (format == "walletway-google-v1") {
                require(value.optString("format") == "moneywise-backup" && value.optInt("version") == 2) { "An older Google file is damaged. No data was removed." }
                val currency = value.getJSONObject("data").getJSONObject("settings").getString("currency")
                if (!entries.has(currency)) entries.put(currency, value)
                if (timestamp.isEmpty()) timestamp = value.getString("createdAt")
                if (activeCurrency.isEmpty()) activeCurrency = currency
            } else {
                // Preserve opaque older encrypted archives inside the single file.
                // They are never deleted until that consolidated payload is verified.
                if (encryptedIds.add(id)) legacy.put(JSONObject().put("sourceId", id).put("name", file.optString("name")).put("data", value))
            }
        }
        val bundle = JSONObject().put("format", "walletway-google-sync").put("version", 1).put("updatedAt", timestamp).put("activeCurrency", activeCurrency).put("ledgers", entries).put("legacyArchives", legacy)
        require(bundle.toString().toByteArray(Charsets.UTF_8).size <= LIMIT) { "Google data is too large to consolidate safely. Existing files were kept." }
        return JSONObject().put("fileId", canonical?.getString("id") ?: "").put("revision", canonicalVersion).put("etag", canonicalTag).put("sources", sources).put("bundle", bundle)
    }
    fun readSync(c: Context, account: String): String = synchronized(lock) { cloud(c, account, access(c, account)).toString() }
    fun register(c: Context, paths: String, activeCurrency: String) = synchronized(lock) {
        val items = JSONObject(paths); require(items.length() in 1..6)
        for (currency in items.keys()) { require(currency in listOf("USD", "INR", "EUR", "GBP", "AUD", "CAD")); require(Regex("moneywise(?:-[A-Z]{3})?\\.db").matches(items.getString(currency))) }
        val p = prefs(c); val previous = JSONObject(p.getString("ledgers", "{}")!!)
        val editor = p.edit().putString("ledgers", items.toString()).putString("activeCurrency", activeCurrency)
        if (p.getBoolean("syncReady", false)) for (currency in items.keys()) if (!previous.has(currency)) editor.putBoolean("ready-$currency", true)
        check(editor.commit())
    }
    fun finish(c: Context, fileId: String, revision: String, timestamp: String) = synchronized(lock) {
        val p = prefs(c); val editor = p.edit().putString("syncFile", fileId).putString("syncRevision", revision).putBoolean("syncReady", true).remove("error")
        val paths = JSONObject(p.getString("ledgers", "{}")!!)
        for (currency in paths.keys()) { editor.putBoolean("ready-$currency", true); if (timestamp.isNotEmpty()) editor.putString("last-$currency", timestamp) }
        check(editor.commit()); schedule(c)
    }
    fun configure(c: Context, account: String, email: String, db: String, currency: String) = synchronized(lock) {
        val user = identity(c, account); require(user.email == email) { "Google account changed." }
        require(Regex("moneywise(?:-[A-Z]{3})?\\.db").matches(db)) { "Invalid ledger path" }
        require(currency in listOf("USD", "INR", "EUR", "GBP", "AUD", "CAD")) { "Unsupported currency" }
        val p = prefs(c)
        if (p.getString("accountId", "") != account) { WorkManager.getInstance(c).cancelAllWorkByTag(TAG); p.edit().clear().commit() }
        val ledgers = JSONObject(p.getString("ledgers", "{}")!!)
        for (entry in ledgers.keys()) p.edit().putBoolean("ready-$entry", false).commit()
        p.edit().putBoolean("syncReady", false).commit()
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
        check(p.getBoolean("syncReady", false)) { "Reconnect Google to restore account data first." }
        val token = access(c, account); val remote = cloud(c, account, token)
        check(remote.getString("fileId") == p.getString("syncFile", "") && remote.getString("revision") == p.getString("syncRevision", "")) { "Google data changed on another device. Reconnect to load the latest data." }
        val bundle = remote.getJSONObject("bundle"); val entries = bundle.getJSONObject("ledgers")
        val paths = JSONObject(p.getString("ledgers", "{}")!!); val included = mutableListOf<String>()
        for (currency in paths.keys()) {
            if (!p.getBoolean("ready-$currency", false)) continue
            val snap = snapshot(c, paths.getString(currency))
            require(snap.getJSONObject("data").getJSONObject("settings").getString("currency") == currency)
            if (!p.getBoolean("ready-$currency", false)) continue
            entries.put(currency, snap); included.add(currency)
        }
        if (included.isEmpty()) return "{}"
        bundle.put("updatedAt", iso(System.currentTimeMillis())).put("activeCurrency", p.getString("activeCurrency", included.first()))
        val content = bundle.toString().toByteArray(Charsets.UTF_8); require(content.size <= LIMIT) { "Sync data exceeds the 25 MB limit." }
        var id = remote.getString("fileId")
        if (id.isEmpty()) {
            val boundary = "walletway_${UUID.randomUUID()}"
            val meta = JSONObject().put("name", "Walletway-sync.json").put("parents", JSONArray().put("appDataFolder")).put("appProperties", JSONObject().put("format", FORMAT))
            val body = "--$boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n$meta\r\n--$boundary\r\nContent-Type: application/json\r\n\r\n${String(content, Charsets.UTF_8)}\r\n--$boundary--\r\n"
            id = JSONObject(String(request(c, account, token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", "POST", body.toByteArray(Charsets.UTF_8), "multipart/related; boundary=$boundary"), Charsets.UTF_8)).getString("id")
        } else {
            val current = metadata(c, account, token, id)
            check(current.getString("version") == remote.getString("revision")) { "Google data changed. Reconnect before syncing." }
            check(remote.getString("etag").isNotEmpty()) { "Google did not provide a safe update token. Reconnect to retry." }
            request(c, account, token, "https://www.googleapis.com/upload/drive/v3/files/${encode(id)}?uploadType=media&fields=id", "PATCH", content, etag = remote.getString("etag"))
        }
        val verified = request(c, account, token, "https://www.googleapis.com/drive/v3/files/${encode(id)}?alt=media")
        check(content.contentEquals(verified)) { "Google sync verification failed. Local data is kept." }
        val finalMeta = metadata(c, account, token, id)
        active(c, account)
        val editor = p.edit().putString("syncFile", id).putString("syncRevision", finalMeta.getString("version")).remove("error")
        for (currency in included) editor.putString("last-$currency", bundle.getString("updatedAt"))
        check(editor.commit())
        // Only remove files whose data was included in the verified consolidated file.
        // If another device changed one in the meantime, leave it for the next sync.
        val originals = ownedFiles(c, account, token)
        for (file in originals) {
            if (file.getString("id") == id) continue
            val source = file.getString("id")
            val sources = remote.getJSONObject("sources")
            if (!sources.has(source)) continue
            val headers = mutableMapOf<String,String>(); val current = metadata(c, account, token, source, headers)
            if (current.getString("version") != sources.getString(source) || headers["etag"].isNullOrEmpty()) continue
            request(c, account, token, "https://www.googleapis.com/drive/v3/files/${encode(source)}", "DELETE", etag = headers["etag"] ?: "")
        }
        return JSONObject().put("fileId", id).put("updatedAt", bundle.getString("updatedAt")).toString()
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
