# Moneywise

Offline-first personal finance app built with **React Native CLI + TypeScript**, targeting Android first. The UI follows the approved Moneywise mobile concept.

## Implemented

- Expense, income, refund and transfer entry; edit, duplicate, delete and undo.
- SQLite persistence; exact integer money calculations; atomic restore.
- Dashboard balances, daily spending, monthly averages, recent activity.
- Search and filters by dates, type, account, category, note/tag and amount.
- Category breakdown, spending trend and income/expense comparisons with text totals.
- Calendar with daily totals, transactions and daily journal.
- Accounts including signed card balances and archive/unarchive.
- Monthly overall/category budgets and savings goal allocation tracking.
- Encrypted local backup/export and restore preview; plaintext CSV export with explicit warning.
- Google Drive app-data snapshot upload/download adapters (OAuth configuration required).
- Google's test banner ads; no financial data passed to ads.
- USD, INR, EUR, GBP, AUD and CAD ledger currencies (two decimal places).

## Setup

Node 20+, JDK 17, Android SDK platform/build-tools 35 and NDK 26.1.10909125.

```sh
npm install
node scripts/prepare-android.cjs
npm run typecheck
npm test
```

The GitHub Actions workflow creates a bundled, signed development release APK under the `Moneywise-Android-APK` artifact. That APK runs without Metro. It uses a development signing key, not a production/store identity. Keep the artifact's key privately for future compatible APK updates. Do not publish real signing keys in the source repository. Each workflow run currently generates a new key: builds from different runs may require uninstall/reinstall unless the workflow is configured with a persistent signing key; export your data before uninstalling.

For a local build, obtain the official Gradle 8.10.2 wrapper JAR at `android/gradle/wrapper/gradle-wrapper.jar`, configure the Android SDK path, and generate/provide a development keystore matching `android/app/build.gradle`. Then run `npm run apk`. For Metro development, use `npm start` and `npm run android`; a debug manifest allowing local HTTP traffic may be needed for device/Metro connectivity.

## Google configuration

Set `GOOGLE_WEB_CLIENT_ID` in `src/config.ts` to a registered Google web OAuth client ID. Register the Android package `com.moneywise` and the installed APK's signing SHA-1 as an Android OAuth client, enable Google Drive API, and complete the consent-screen setup. The workflow includes the certificate fingerprint in its artifact. OAuth client IDs are public configuration; **never place client secrets or tokens in source code**.

Backups use the restricted `drive.appdata` scope and are uploaded on explicit user action. Every snapshot is immutable and verified by download before success is reported. This release does not implement automatic background backups or multi-device synchronization. Sign-in is disabled visibly until configured. Reconnect Google after opening the Backup screen if the connection display has reset.

## Encryption and recovery

Local/Drive archives use AES-256-CBC with encrypt-then-HMAC-SHA256 and separate encryption/authentication keys derived through PBKDF2-SHA256 (210,000 iterations, random salt). HMAC is verified before decryption. Native crypto is supplied by `react-native-aes-crypto`. The recovery passphrase must be at least 12 characters, is not persisted, and is required for recovery on another device. A passphrase cannot be recovered through Google. The SQLite database is app-private but **not encrypted at rest**. OS automatic backup is disabled to avoid unintended copies.

Restore validates all records and replaces tables in one SQLite transaction. An app-private pre-restore safety JSON snapshot is created first; it is not an encrypted shareable backup. A UI for browsing these safety copies is not included yet. The database uses versioned entity tables with JSON payloads, not the indexed reporting schema proposed for a later high-volume release; this version loads the ledger into memory for calculations.

## Advertising

Only test application/unit IDs are configured. Offline or failed banner loads disappear. Before enabling live monetization, configure your AdMob IDs, implement/test regional consent and applicable iOS tracking behavior, and publish accurate privacy/store disclosures. Test ads must remain during development.

## Delivery scope and known limitations

This is a first Android build, not the entire multi-phase specification. Recurring bills/local reminders, debts, receipt attachments, biometric lock, dark mode, budget notifications, automatic backups, production ad consent, multi-device sync and iOS native project are not included yet. Charts/list totals use the same filters; refunds can produce negative spending, which is shown in a table rather than a misleading donut. Reports cap custom ranges at ten years. Archive import is capped at 25 MB and 100,000 entities per table. Backup round trips/native crypto and device UX require runtime validation before production use. Do not claim a zero-data-loss guarantee.

## Verification

`npm test` verifies decimal parsing, balances, transfers/refunds, filter consistency, calendar boundaries and restore validation using Node's test runner. `npm run typecheck` checks the React Native source. The CI workflow builds the Android release variant and attaches the APK, checksum, certificate details, development signing key and dependency lockfile. A successful build proves packaging, not device or UI correctness; test on actual devices before distribution.
