# Walletway privacy policy — release review draft

This draft describes the Android UAT code. The owner must supply contact details, publish a policy URL, confirm release regions and verify advertising/store disclosures before public release.

Walletway stores your ledger, categories, accounts, notes, planning records and receipt images in app-private device storage. Core money management works offline. This build does not add analytics or send financial records to advertising SDKs.

Local reminders use Android notification and alarm services. Permission is requested when you enable reminders or budget alerts. Notification text does not include transaction amounts or account names. Biometrics/screen-lock verification is performed by Android; Walletway does not obtain your biometric templates, PIN or password. The app lock does not encrypt the live SQLite database.

You choose images through the system document picker. A private copy, limited to 5 MB, is stored with your record. Encrypted local backup includes attached receipts up to the combined archive limit. Your recovery passphrase is required to decrypt archives. Manual backup does not persist it. Enabling automatic Drive backup protects it on your device using Android Keystore AES-GCM; disconnect removes saved passphrases for that account. Unencrypted CSV/PDF exports contain financial information; you choose where to share them.

You can connect a Google account in Settings. With Drive app-data permission, Walletway uploads encrypted snapshots to that account’s private app folder. Automatic backup is optional and uploads changes while the app is open. Google receives encrypted archives and file metadata including ledger currency, identifier and timestamps. The app uses your Google identity to display the connected email and separate backup settings. Tokens are managed by the Google sign-in SDK. Restore is explicit and replaces the selected ledger; backups do not merge simultaneous edits. Drive snapshots are retained until removed through the account’s app-data controls and use its storage quota. Disconnecting stops future backups and removes saved local recovery passphrases but does not delete Drive backups.

This build uses Google test banners without extra ad controls. For these banners, Google’s consent SDK checks applicable consent before ad SDK initialization and requests test ads. The Google SDK may process device/network information under its own policies. Financial notes, balances, names and amounts are not supplied as ad parameters. Real monetization requires owner AdMob configuration and a reviewed regional consent setup.

Deleting the selected ledger removes its records and referenced receipts, while other currency ledgers remain. Uninstalling can remove device-local records. Export each ledger regularly if you need portable recovery. Recovery copies are private local plaintext and are not a substitute for an encrypted export.

Owner contact: to be supplied before publication.
