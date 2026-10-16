# Walletway privacy policy — release review draft

This draft describes the Android UAT code. The owner must supply contact details, publish a policy URL, confirm release regions and verify advertising/store disclosures before public release.

Walletway stores your ledger, categories, accounts, notes, planning records and receipt images in app-private device storage. Core money management works offline. This build does not add analytics or send financial records to advertising SDKs.

Local reminders use Android notification and alarm services. Permission is requested when you enable reminders or budget alerts. Notification text does not include transaction amounts or account names. Biometrics/screen-lock verification is performed by Android; Walletway does not obtain your biometric templates, PIN or password. The app lock does not encrypt the live SQLite database.

You choose images through the system document picker. A private copy, limited to 5 MB, is stored with your record. Encrypted local backup includes attached receipts up to the combined archive limit. Your recovery passphrase is required to decrypt archives. New Google backup does not use a recovery passphrase. Local export and older encrypted archives still require one. Older saved passphrase caches remain device-protected until disconnect, when they are removed. Unencrypted CSV/PDF exports contain financial information; you choose where to share them.

You can connect a Google account in Backup & restore or Settings. New backups contain your ledger and receipt data as JSON in the account’s private Google Drive app-data folder, sent over HTTPS. They rely on Google account and Drive protections; they are not separately app-password encrypted or end-to-end encrypted. A persistent Android job schedules daily backups for local midnight; Android can delay the work. Google receives financial records, attachments, currency, ledger identifier and timestamps. The selected Google email is shown in the app, and the account identifier binds backup permissions to the chosen account. Tokens are managed by Google SDKs and are not placed in scheduled-work input. A fresh ledger can restore an existing backup after sign-in; existing local records require explicit replacement confirmation. Backups preserve separate versions and do not merge edits. Disconnect stops future scheduled work and clears older saved passphrase caches but does not delete Drive backups. Versions use the account’s storage quota until removed through its app-data controls.

This build uses Google test banners without extra ad controls. For these banners, Google’s consent SDK checks applicable consent before ad SDK initialization and requests test ads. The Google SDK may process device/network information under its own policies. Financial notes, balances, names and amounts are not supplied as ad parameters. Real monetization requires owner AdMob configuration and a reviewed regional consent setup.

Deleting the selected ledger removes its records and referenced receipts, while other currency ledgers remain. Uninstalling can remove device-local records. Export each ledger regularly if you need portable recovery. Recovery copies are private local plaintext and are not a substitute for an encrypted export.

Owner contact: to be supplied before publication.


## Google sync (0.7.0)
One private Google Drive app-data file contains all currency ledgers and is updated in place. Connecting automatically restores saved records, including when local records exist. Internal pre-restore safety copies protect interrupted restores; there are no local backup or restore controls. Existing app-owned Google archives are consolidated and removed only after verifying the new file, with concurrent changes preserved. Older encrypted archives remain opaque inside the consolidated file. Daily sync is scheduled at local midnight; Android may delay execution. Conflicting changes from another device require reconnecting before uploads resume. Real-account consent, upload and reinstall restoration must be verified on a configured Google-enabled phone.
