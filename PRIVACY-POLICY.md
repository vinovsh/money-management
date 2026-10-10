# Walletway privacy policy — release review draft

This draft describes the Android UAT code. The owner must supply contact details, publish a policy URL, confirm release regions and verify advertising/store disclosures before public release.

Walletway stores your ledger, categories, accounts, notes, planning records and receipt images in app-private device storage. Core money management works offline. This build does not add analytics or send financial records to advertising SDKs.

Local reminders use Android notification and alarm services. Permission is requested when you enable reminders or budget alerts. Notification text does not include transaction amounts or account names. Biometrics/screen-lock verification is performed by Android; Walletway does not obtain your biometric templates, PIN or password. The app lock does not encrypt the live SQLite database.

You choose images through the system document picker. A private copy, limited to 5 MB, is stored with your record. Encrypted local backup includes attached receipts up to the combined archive limit. Your recovery passphrase is required to decrypt archives and is not stored by the app. Unencrypted CSV/PDF exports contain financial information; you choose where to share them.

Google backup is not configured for this UAT build. The existing optional adapter can send encrypted snapshots to your private Google Drive app-data folder only after account configuration and explicit user action.

Demo/test advertising is visible by default and can be disabled in Settings. The labelled local preview itself makes no network requests. For the Google test banner, Google’s consent SDK checks applicable consent before ad SDK initialization and requests test ads. The Google SDK may process device/network information under its own policies. Financial notes, balances, names and amounts are not supplied as ad parameters. Real monetization requires owner AdMob configuration and a reviewed regional consent setup.

Deleting the selected ledger removes its records and referenced receipts, while other currency ledgers remain. Uninstalling can remove device-local records. Export each ledger regularly if you need portable recovery. Recovery copies are private local plaintext and are not a substitute for an encrypted export.

Owner contact: to be supplied before publication.
