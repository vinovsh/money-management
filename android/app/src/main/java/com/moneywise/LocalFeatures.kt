package com.moneywise

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.os.Build
import android.os.CancellationSignal
import android.hardware.biometrics.BiometricPrompt
import android.hardware.biometrics.BiometricManager
import com.facebook.react.bridge.*
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Calendar

object LocalReminders {
    private const val CHANNEL = "walletway_reminders"
    private fun prefs(c: Context) = c.getSharedPreferences("walletway_reminders", Context.MODE_PRIVATE)
    private fun intent(c: Context, id: String): PendingIntent = PendingIntent.getBroadcast(c, id.hashCode(), Intent(c, ReminderReceiver::class.java).setAction("walletway.$id").putExtra("id", id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    fun permitted(c: Context): Boolean = (Build.VERSION.SDK_INT < 33 || c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) && (c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).areNotificationsEnabled()
    fun notify(c: Context, id: String, title: String, body: String): Boolean {
        if (!permitted(c)) return false
        val manager = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(CHANNEL, "Walletway reminders", NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(c, 0, Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(c, CHANNEL) else Notification.Builder(c)
        manager.notify(id.hashCode(), builder.setSmallIcon(R.drawable.ic_notification).setContentTitle(title).setContentText(body).setContentIntent(open).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE).build())
        return true
    }
    fun save(c: Context, json: String) {
        val previous = JSONArray(prefs(c).getString("alarms", "[]"))
        val alarm = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (i in 0 until previous.length()) alarm.cancel(intent(c, previous.getJSONObject(i).getString("id")))
        prefs(c).edit().putString("alarms", json).apply()
        reschedule(c)
    }
    fun reschedule(c: Context) {
        val items = JSONArray(prefs(c).getString("alarms", "[]"))
        val alarm = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            val trigger = if (item.optBoolean("daily")) {
                val cal = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, item.getInt("hour")); set(Calendar.MINUTE, item.getInt("minute")); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
                if (cal.timeInMillis <= System.currentTimeMillis()) cal.add(Calendar.DAY_OF_YEAR, 1)
                cal.timeInMillis
            } else item.getLong("at")
            if (trigger > System.currentTimeMillis()) alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, intent(c, item.getString("id")))
        }
    }
    fun receive(c: Context, id: String) {
        val items = JSONArray(prefs(c).getString("alarms", "[]"))
        for (i in 0 until items.length()) { val item = items.getJSONObject(i); if (item.getString("id") == id) {
            val marker = if (item.optBoolean("daily")) "daily-${Calendar.getInstance().get(Calendar.YEAR)}-${Calendar.getInstance().get(Calendar.DAY_OF_YEAR)}" else "alarm-$id-${item.optLong("at")}" 
            if (!prefs(c).getBoolean(marker, false) && notify(c, id, item.getString("title"), item.getString("body"))) prefs(c).edit().putBoolean(marker, true).apply()
        } }
        reschedule(c)
    }
    fun once(c: Context, id: String, title: String, body: String): Boolean {
        if (prefs(c).getBoolean("once-$id", false)) return true
        if (!notify(c, id, title, body)) return false
        prefs(c).edit().putBoolean("once-$id", true).apply(); return true
    }
    fun clear(c: Context) { save(c, "[]"); (c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancelAll() }
}
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) { if (intent.action?.startsWith("walletway.") == true) LocalReminders.receive(context, intent.getStringExtra("id") ?: return) else LocalReminders.reschedule(context) }
}
class LocalFeaturesModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private var pending: Promise? = null
    private var authenticating = false
    private val listener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode != 871 && requestCode != 872) return
            val promise = pending ?: return; pending = null
            if (requestCode == 872) { promise.resolve(resultCode == Activity.RESULT_OK); return }
            if (resultCode != Activity.RESULT_OK || data?.data == null) { promise.resolve(null); return }
            try {
                val uri = data.data!!; val mime = context.contentResolver.getType(uri) ?: ""
                if (!mime.startsWith("image/")) throw IllegalArgumentException("Choose an image receipt.")
                val dir = File(context.filesDir, "receipts").apply { mkdirs() }
                val target = File(dir, "${java.util.UUID.randomUUID()}.${if (mime == "image/png") "png" else "jpg"}")
                try { context.contentResolver.openInputStream(uri).use { input -> requireNotNull(input); target.outputStream().use { output -> val buffer = ByteArray(8192); var total = 0; while (true) { val size = input.read(buffer); if (size < 0) break; total += size; if (total > 5 * 1024 * 1024) throw IllegalArgumentException("Receipt must be smaller than 5 MB."); output.write(buffer, 0, size) } } } } catch (e: Exception) { target.delete(); throw e }
                promise.resolve(target.absolutePath)
            } catch (e: Exception) { promise.reject("RECEIPT", e.message, e) }
        }
    }
    init { context.addActivityEventListener(listener) }
    override fun getName() = "LocalFeatures"
    private fun backupJob(promise: Promise, operation: () -> String) {
        Thread { try { promise.resolve(operation()) } catch (e: Exception) { promise.reject("GOOGLE_BACKUP", e.message, e) } }.start()
    }
    @ReactMethod fun googleBackupConfigure(account: String, email: String, db: String, currency: String, promise: Promise) { backupJob(promise) { GoogleDailyBackup.configure(context, account, email, db, currency); GoogleDailyBackup.status(context, currency) } }
    @ReactMethod fun googleBackupAccept(currency: String, remote: String, timestamp: String, promise: Promise) { backupJob(promise) { GoogleDailyBackup.accept(context, currency, remote, timestamp); GoogleDailyBackup.status(context, currency) } }
    @ReactMethod fun googleBackupPause(currency: String, promise: Promise) { backupJob(promise) { GoogleDailyBackup.pause(context, currency); "true" } }
    @ReactMethod fun googleBackupStatus(currency: String, promise: Promise) { promise.resolve(GoogleDailyBackup.status(context, currency)) }
    @ReactMethod fun googleBackupList(account: String, currency: String, promise: Promise) { backupJob(promise) { GoogleDailyBackup.discover(context, account, currency) } }
    @ReactMethod fun googleBackupRun(promise: Promise) { backupJob(promise) { GoogleDailyBackup.perform(context) } }
    @ReactMethod fun googleBackupDisconnect(promise: Promise) { backupJob(promise) { GoogleDailyBackup.disconnect(context); "true" } }
    @ReactMethod fun googleBackupReschedule(promise: Promise) { GoogleDailyBackup.schedule(context); promise.resolve(true) }
    // Recovery passphrases for optional automatic backups are device-local only.
    // AES-GCM authenticates the value and its account/ledger storage key.
    private fun driveKey(): javax.crypto.SecretKey {
        val store = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = store.getKey("walletway-drive-v1", null)
        if (existing != null) return existing as javax.crypto.SecretKey
        val generator = javax.crypto.KeyGenerator.getInstance(android.security.keystore.KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(android.security.keystore.KeyGenParameterSpec.Builder("walletway-drive-v1", android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or android.security.keystore.KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE).build())
        return generator.generateKey()
    }
    @ReactMethod fun driveSecretGet(key: String, promise: Promise) {
        try {
            val encoded = context.getSharedPreferences("drive-secrets", Context.MODE_PRIVATE).getString(key, null)
            if (encoded == null) { promise.resolve(null); return }
            val value = org.json.JSONObject(encoded)
            val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(javax.crypto.Cipher.DECRYPT_MODE, driveKey(), javax.crypto.spec.GCMParameterSpec(128, android.util.Base64.decode(value.getString("iv"), android.util.Base64.NO_WRAP)))
            cipher.updateAAD(key.toByteArray(Charsets.UTF_8))
            promise.resolve(String(cipher.doFinal(android.util.Base64.decode(value.getString("data"), android.util.Base64.NO_WRAP)), Charsets.UTF_8))
        } catch (e: Exception) { promise.reject("DRIVE_SECRET", "Cannot unlock saved backup settings. Reconnect Google and enter your recovery passphrase.", e) }
    }
    @ReactMethod fun driveSecretSet(key: String, value: String?, promise: Promise) {
        try {
            val editor = context.getSharedPreferences("drive-secrets", Context.MODE_PRIVATE).edit()
            if (value == null) editor.remove(key) else {
                val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, driveKey()); cipher.updateAAD(key.toByteArray(Charsets.UTF_8))
                val encoded = org.json.JSONObject().put("iv", android.util.Base64.encodeToString(cipher.iv, android.util.Base64.NO_WRAP))
                    .put("data", android.util.Base64.encodeToString(cipher.doFinal(value.toByteArray(Charsets.UTF_8)), android.util.Base64.NO_WRAP))
                editor.putString(key, encoded.toString())
            }
            if (!editor.commit()) throw java.io.IOException("Could not save backup settings")
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("DRIVE_SECRET", "Could not save encrypted backup settings.", e) }
    }
    @ReactMethod(isBlockingSynchronousMethod = true) fun uuid(): String = java.util.UUID.randomUUID().toString()
    @ReactMethod fun schedule(json: String, promise: Promise) { try { LocalReminders.save(context, json); promise.resolve(true) } catch (e: Exception) { promise.reject("REMINDER", e.message, e) } }
    @ReactMethod fun notifyOnce(id: String, title: String, body: String, promise: Promise) { try { promise.resolve(LocalReminders.once(context, id, title, body)) } catch (e: Exception) { promise.reject("NOTIFICATION", e.message, e) } }
    @ReactMethod fun notificationStatus(promise: Promise) { promise.resolve(LocalReminders.permitted(context)) }
    @ReactMethod fun clear(promise: Promise) { LocalReminders.clear(context); promise.resolve(true) }
    @ReactMethod fun pickReceipt(promise: Promise) {
        val activity = currentActivity ?: run { promise.reject("ACTIVITY", "Open the app to attach a receipt."); return }
        if (pending != null || authenticating) { promise.reject("BUSY", "Finish the current request first."); return }
        pending = promise
        try { activity.startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE), 871) } catch (e: Exception) { pending = null; promise.reject("RECEIPT", e.message, e) }
    }
    @ReactMethod fun authenticate(promise: Promise) {
        val activity = currentActivity ?: run { promise.resolve(false); return }
        val manager = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        if (!manager.isDeviceSecure) { promise.reject("NO_LOCK", "Set a screen lock on your phone first."); return }
        if (pending != null || authenticating) { promise.reject("BUSY", "Finish the current request first."); return }
        if (Build.VERSION.SDK_INT >= 30) {
            authenticating = true
            activity.runOnUiThread {
                try {
                    val prompt = BiometricPrompt.Builder(activity).setTitle("Unlock Walletway").setSubtitle("Use biometrics or your device screen lock.").setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL).build()
                    prompt.authenticate(CancellationSignal(), context.mainExecutor, object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { authenticating = false; promise.resolve(true) }
                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) { authenticating = false; promise.resolve(false) }
                    })
                } catch (e: Exception) { authenticating = false; promise.reject("AUTH", e.message, e) }
            }
            return
        }
        val intent = manager.createConfirmDeviceCredentialIntent("Unlock Walletway", "Use your device screen lock to open your money records.")
        if (intent == null) { promise.resolve(false); return }
        pending = promise; activity.startActivityForResult(intent, 872)
    }
    @ReactMethod fun exportPDF(title: String, lines: ReadableArray, promise: Promise) {
        try {
            val doc = PdfDocument(); val paint = Paint().apply { textSize = 11f; isAntiAlias = true }
            var page: PdfDocument.Page? = null; var y = 0; var number = 0
            fun nextPage() { page?.let { doc.finishPage(it) }; number++; page = doc.startPage(PdfDocument.PageInfo.Builder(595, 842, number).create()); y = 40; paint.textSize = 18f; page!!.canvas.drawText(title.take(60), 35f, y.toFloat(), paint); y += 30; paint.textSize = 11f }
            nextPage()
            for (i in 0 until lines.size()) { val text = lines.getString(i) ?: ""; for (part in text.chunked(82)) { if (y > 795) nextPage(); page!!.canvas.drawText(part, 35f, y.toFloat(), paint); y += 17 }; if (text.isEmpty()) y += 17 }
            page?.let { doc.finishPage(it) }; val file = File(context.cacheDir, "Walletway-report.pdf"); file.outputStream().use { doc.writeTo(it) }; doc.close(); promise.resolve(file.absolutePath)
        } catch (e: Exception) { promise.reject("PDF", e.message, e) }
    }
}
class LocalFeaturesPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = listOf(LocalFeaturesModule(reactContext))
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
