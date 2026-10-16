# Walletway – Money Management

Offline-first personal finance app built with **React Native CLI + TypeScript**, targeting Android first. The UI follows the approved Walletway mobile concept.

## Version 0.4.0 UAT

See [UAT-CHECKLIST.md](UAT-CHECKLIST.md) for implemented features and remaining production acceptance work. This branch adds native evening reminders, templates, recurrence, debt repayments, advanced budgets, receipt backups, PDF reports, period comparisons, agenda view, separate currency ledgers, recovery previews and device authentication. Google account backup is available in Settings. Notifications use Android services with no third-party reminder library.

## Version 0.3.2

- Modal content mounts after the opening animation, inside an explicitly bounded scroll viewport.
- Android uses native keyboard resizing; hidden modal content is unmounted.
- Category holds arm reordering without locking scroll. Only an active drag locks it; release, cancellation and closing restore scrolling.

## Version 0.3.1

- One Date & time field: date on the left, 12-hour AM/PM time on the right.
- Alarm-style round clock picker for hours and minutes, with draggable hand and exact-minute adjustment.
- New transaction forms initialize to the current local time each time they open; existing timestamps are preserved.

## Version 0.3.0

- Approved blue Wallet M launcher logo and blue default accent.
- Appearance is a separate More option.
- Calendar fits seven columns with slide gestures and arrow navigation. Daily values use K/M abbreviations; selected-day totals remain exact.
- Cash, Card and Account payment options are added without altering existing balances.
- Hold and drag category cards to save their order; use the final + card to add one. Edit categories under More.
- Spaced date picker and 24-hour transaction time picker. Older records keep their original date without an invented time.
- More icons opens from the three-dot icon button.
- Modal scrolling supports nested scrolling and keyboard dismissal.

## Version 0.2.0

- Tap a date to open a calendar modal (transactions and custom report ranges). Choose a day and tap **Use selected date**.
- Open **More → Categories** to add or edit expense/income categories. Transaction forms also offer **Add category** and long-press editing. Renames preserve category IDs and existing records.
- Open **More → Settings → Appearance** for saved Light/Dark themes and five primary colors. Older ledgers default to Light and teal.

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

The GitHub Actions workflow creates a bundled, signed development release APK under the `Walletway-UAT-APK` artifact. That APK runs without Metro. It uses a development signing key, not a production/store identity. Keep the artifact's key privately for future compatible APK updates. Do not publish real signing keys in the source repository. UAT tries to reuse the key in the previous available build artifact. If no prior key is available, a new one is generated and reinstall may be necessary; export your data before uninstalling.

For a local build, obtain the official Gradle 8.10.2 wrapper JAR at `android/gradle/wrapper/gradle-wrapper.jar`, configure the Android SDK path, and generate/provide a development keystore matching `android/app/build.gradle`. Then run `npm run apk`. For Metro development, use `npm start` and `npm run android`; a debug manifest allowing local HTTP traffic may be needed for device/Metro connectivity.

## Google account backup (0.7.0)

More → Backup & restore and Settings show a compact Google-branded sync card. Connecting automatically restores the account's saved records across all currency ledgers, replacing local records after internal safety copies. One private `appDataFolder` JSON file is updated in place; there are no manual backup, restore, local-file, or version-selection controls. Older app-owned files are consolidated and removed only after read-back verification and source-version checks. Old encrypted archives are retained opaque inside the consolidated file. Disconnect stops scheduling and keeps Google data and local records.

Google sync uses HTTPS and Google account/Drive protection, not a separate app password or end-to-end encryption. Google SDKs manage tokens. A remote change on another device pauses uploads until reconnecting restores the current account data; concurrent device edits are not automatically merged.

Android WorkManager persists one-time work targeted at the next local midnight (12 AM), requires network connectivity, retries transient I/O failures with backoff, and schedules the following local midnight after completion. Time/timezone changes recalculate the schedule; WorkManager restores work after reboot. Tasks may be delayed by Doze, lack of network, battery policies or force-stop; exact midnight delivery is not promised. Java Calendar calculations handle DST days rather than assuming a fixed 24-hour interval. Backup workers read each registered SQLite database in a consistent transaction and include app-private receipts without booting React Native. Device-only lock/ad settings are excluded. A backup is marked successful only after a read-back comparison.

The supplied public Android OAuth ID/project (`playstore-apps-511810`) are recorded in `src/config.ts`; Android ID must not be passed as `webClientId`. Register `com.moneywise` and SHA-1 `48:89:0D:7E:79:AC:39:B6:FE:CB:8F:B9:27:D3:7C:9B:05:62:9B:B6` in the same project, enable Google Drive API and configure consent/test users. Store-distributed APKs must register the Play signing fingerprint too. Real Google account access still requires signed-device acceptance. Native worker authorization uses Google's AuthorizationClient with the already selected account and the narrow Drive app-data scope; it requests no server refresh token and shows no consent UI from the background. If fresh consent is required, the worker stops and the UI asks to reconnect.

## Encryption and recovery

Local/Drive archives use AES-256-CBC with encrypt-then-HMAC-SHA256 and separate encryption/authentication keys derived through PBKDF2-SHA256 (210,000 iterations, random salt). HMAC is verified before decryption. Native crypto is supplied by `react-native-aes-crypto`. For encrypted local files and older Google archives, the recovery passphrase must be at least 12 characters and is required for recovery. New account-protected Google backups do not use this envelope. A passphrase cannot be recovered through Google. The SQLite database is app-private but **not encrypted at rest**. OS automatic backup is disabled to avoid unintended copies.

Restore validates all records and replaces tables in one SQLite transaction. An app-private pre-restore safety JSON snapshot is created first; it is not an encrypted shareable backup. These safety files are internal; there is no local recovery control. The database uses versioned entity tables with JSON payloads and additive transaction indexes, rather than the full normalized reporting schema proposed for a later high-volume release; this version loads the ledger into memory for calculations.

## Advertising

Only test application/unit IDs are configured. Extra ad captions and settings controls are removed; failed test ads stay hidden and retry automatically. Before enabling live monetization, configure your AdMob IDs, implement/test regional consent and applicable iOS tracking behavior, and publish accurate privacy/store disclosures. Test ads must remain during development.

## Delivery scope and known limitations

This is a first Android build, not the entire multi-phase specification. Production owner/store configuration, multi-device conflict merging and the iOS native project remain outside this Android build. See the current UAT checklist for feature coverage. Charts/list totals use the same filters; refunds can produce negative spending, which is shown in a table rather than a misleading donut. Reports cap custom ranges at ten years. Archive import is capped at 25 MB and 100,000 entities per table. Backup round trips/native crypto and device UX require runtime validation before production use. Do not claim a zero-data-loss guarantee.

## Verification

`npm test` verifies decimal parsing, balances, transfers/refunds, filter consistency, calendar boundaries and restore validation using Node's test runner. `npm run typecheck` checks the React Native source. The CI workflow builds the Android release variant and attaches the APK, checksum, certificate details, development signing key and dependency lockfile. A successful build proves packaging, not device or UI correctness; test on actual devices before distribution.

## Walletway 0.4.1

More → Guide provides offline instructions for recording and editing transactions, calendar, reports, categories, budgets, goals, recurring entries, debts, appearance, notifications, security and Google sync. Home uses Google test banners without additional captions or ad controls. Google consent gating remains in place for SDK ads. The consolidated Android implementation is on main; production configuration and other pending items remain documented in UAT-CHECKLIST.md.


## Google sync (0.7.0)
One private Google Drive app-data file contains all currency ledgers and is updated in place. Connecting automatically restores saved records, including when local records exist. Internal pre-restore safety copies protect interrupted restores; there are no local backup or restore controls. Existing app-owned Google archives are consolidated and removed only after verifying the new file, with concurrent changes preserved. Older encrypted archives remain opaque inside the consolidated file. Daily sync is scheduled at local midnight; Android may delay execution. Conflicting changes from another device require reconnecting before uploads resume. Real-account consent, upload and reinstall restoration must be verified on a configured Google-enabled phone.
