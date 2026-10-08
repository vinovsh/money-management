# Money Management — Technical Specification

Version: 1.0 · Status: proposed implementation specification · Date: October 7, 2026

## 1. Product definition

A React Native CLI application for personal money management on Android and iOS. Users can record expenses and income, manage accounts, plan budgets, view statistics, and review spending in a calendar. All core features work without an internet connection or an account. Ads support the free app when online. Optional Google Drive backup protects data across reinstalls and device changes.

“Daily experience calculation” is interpreted as daily expense calculation. This document specifies the app; it does not claim that an app or GitHub repository has been created.

### Product principles

- Record a transaction in a few taps; show useful totals immediately.
- Keep the device database as the source of truth for normal use.
- Make login optional and request permissions only when needed.
- Explain totals, filters, backup status, and errors in plain language.
- Preserve records through crashes, upgrades, imports, and restore operations.
- Never send financial records, notes, account names, or amounts to advertising services.

### Scope boundaries

This is a personal ledger, not a banking service. Automatic bank imports, payments, investment trading, tax filing, and shared household editing are outside the initial scope. Currency conversions require explicit rates; an offline app cannot guarantee current exchange rates. Backup reduces loss risk but cannot guarantee recovery of changes that were never backed up or data whose encryption key is lost.

## 2. Feature specification

| Area | Required behavior | Delivery |
|---|---|---|
| Expenses and income | Amount, category, account, date/time, notes, tags; add, edit, delete, duplicate | MVP |
| Quick entry | Numeric keypad, recent categories, defaults, reusable templates | MVP |
| Accounts | Cash, bank, card, wallet; opening balances, archives, transfers | MVP |
| Dashboard | Today/month expenses, income, net cash flow, balances, recent activity | MVP |
| Statistics | Category donut, daily trend, income/expense bars, period comparisons | MVP |
| Filters | Date range, type, account, category, tags, amount, note search | MVP |
| Calendar | Daily income/expense totals; tap a date to see its transactions | MVP |
| Notes | Transaction notes and a separate daily money journal | MVP |
| Budgets | Overall and category monthly limits; progress and alerts | MVP |
| Backup | Local export/import and optional encrypted Google Drive snapshots | MVP |
| Ads | Restrained banners/native placements; consent-aware online behavior | MVP |
| Recurring items | Bills, salary, subscriptions, scheduled reminders | Phase 2 |
| Goals | Savings targets and explicitly allocated contributions | Phase 2 |
| Debts | Money lent/borrowed, repayments, due reminders | Phase 2 |
| Reports | Custom chart sets, comparisons, CSV/PDF exports | Phase 2 |
| Receipts | Optional photos, attachment limits, encrypted backup inclusion | Phase 2 |
| Advanced budgets | Weekly/custom periods, rollover, tag budgets | Phase 2 |
| Multiple currencies | Separate currency totals and explicit conversion rates | Phase 2 |
| Device sync | Multi-device change merge with conflict resolution | Phase 3 |

### Transaction entry

The main Add button opens an expense form with an expense/income/transfer switch. Start with amount and category; put optional fields behind an expandable section. Default to the last selected account and today. Validate before saving, prevent duplicate submits, and allow an undo action after deletion.

Store refunds with a link to the original expense where available. MVP supports expense refunds only; reversing an income payment requires a separate explicit adjustment workflow. Transfers select two different accounts and must commit both sides atomically. Fees are separate expenses linked to a transfer.

### Dashboard and daily calculations

Show today’s spending, month-to-date spending, month-to-date income, net cash flow, remaining budget, account balances, and recent transactions. Let users hide balances and reorder summary cards.

For selected scope and date range:

- Gross expenses = total expense transactions.
- Net spending = gross expenses minus expense refunds dated within the range.
- Income = total income transactions; exclude refunds and transfers.
- Net cash flow = income minus net spending.
- Average daily spending = net spending divided by all calendar days in the selected range, including zero-spend days. For “this month so far,” use elapsed calendar days through today.
- Remaining budget = budget amount minus eligible net spending. Negative values indicate overspending.
- Savings rate = net cash flow / income × 100, only when income is positive; otherwise display “Not available.”

Do not call net cash flow “account balance.” Balance includes opening balance and transfers. Savings-goal contributions are allocations, not extra spending. Label forecasts as estimates and explain the formula.

### Statistics and filtering

Provide a category donut, daily/weekly line chart, income-versus-expense bar chart, category ranking, and period comparison. Phase 2 adds a spending heatmap, cumulative trend, and savings-goal progress.

Every chart uses the same visible filter state as its underlying list. Show totals and a text/table alternative for accessibility. Filter presets include today, this week, this month, last month, this year, and custom range. Show active filter chips, a Clear action, and distinct empty states for “no records” versus “no matches.”

Category shares require nonnegative values. If refunds make a category negative, display a signed bar/table instead of a donut. Period comparisons show absolute difference; show percentage change only when the prior value is positive. Mark partial-period comparisons clearly.

### Calendar and journal

Offer month and agenda views. Each day shows expense and income totals with separate indicators. Selecting a day opens its transactions, net cash flow, journal entry, and scheduled bills. Today and the selected day must remain visually distinguishable. Support locale-specific first day of week and screen-reader labels such as “October 7: expenses 45 dollars, income zero.”

### Budgets and reminders

MVP budgets are monthly, overall or category-specific, and in one ledger currency. Category budgets may coexist with the overall budget without double-counting in calculations. Default progress thresholds are 80% and 100%; users can change or disable them. Persist which threshold was notified per budget period to prevent repeat alerts.

Recurring schedules and bill reminders use local notifications. Offer reminder-only and automatic-entry modes, with reminder-only as the default. Catch up schedules when the app opens; do not assume background jobs run on time. Use a unique occurrence key so retries cannot create the same bill twice. Let users review missed entries before inserting a large backlog.

## 3. Friendly UI and navigation

### Main navigation

Five tabs: **Home**, **Transactions**, **Calendar**, **Statistics**, **More**. A prominent Add action is accessible throughout the main screens. More contains accounts, budgets, goals, debts, backup, export, privacy, and settings.

### Visual direction

Use calm neutral surfaces, generous spacing, clear typography, and a restrained teal accent. Differentiate income and expense with labels and icons as well as color. Support light/dark themes and system settings. Use locale-aware money formatting, readable chart labels, and large amount text on entry screens.

- Touch targets: at least 44 points on iOS and 48 dp on Android.
- Respect font scaling, safe areas, reduced motion, and keyboard avoidance.
- Meet WCAG AA contrast targets where applicable.
- Use platform-appropriate date pickers and accessible numeric inputs.
- Never place ads beside Save, Delete, or navigation controls where accidental taps are likely.
- Empty screens include one useful next action rather than sample financial records that look real.

### First launch

1. Choose currency and locale; explain that MVP uses one ledger currency.
2. Create the first account with an optional opening balance.
3. Offer an optional daily reminder.
4. Explain local storage and offer Google backup with a Skip action.
5. Open Home with an Add your first transaction action.

Do not block onboarding on network access or ad loading. Changing the ledger currency after transactions exist must not silently relabel amounts; require an explicit conversion/migration flow or keep that setting locked in MVP.

## 4. Technical architecture

### Recommended stack

| Concern | Recommendation |
|---|---|
| Application | React Native CLI with TypeScript; no Expo runtime dependency |
| Navigation | React Navigation |
| Durable storage | SQLite; evaluate `react-native-nitro-sqlite` for the chosen React Native version |
| Database encryption | Select a SQLite binding with verified SQLCipher support if encrypted DB storage is required; do not assume the suggested binding includes it |
| UI state | Zustand for preferences and temporary filter/form state |
| Forms | React Hook Form and Zod |
| Charts | Victory Native or an SVG-based chart library; validate accessibility and release-build performance |
| Secure storage | `react-native-keychain` backed by platform secure storage |
| Google identity | `@react-native-google-signin/google-signin` with platform OAuth configuration |
| Backup storage | Google Drive REST API, restricted `drive.appdata` scope |
| Notifications | Notifee, subject to current platform permission and scheduling rules |
| Advertising | Google Mobile Ads native SDK through a maintained React Native binding |
| Dates | A tested timezone-aware date library plus `Intl` formatting |
| Tests | Jest for domain logic; React Native Testing Library; Maestro or Detox for critical journeys |

Pin versions after verifying Android/iOS, New Architecture, native build, and license compatibility. Native SDK behavior and store policies must be checked against current documentation during implementation.

### Layers

UI → use cases → domain rules → repositories → SQLite/native adapters.

- Screens render view models and do not contain raw SQL or ad/backup business rules.
- Domain services handle money, dates, balances, recurrence, budgets, and restore validation.
- Repositories execute parameterized queries and atomic writes.
- Native adapters handle secure storage, files, notifications, OAuth, ads, and background scheduling.
- Backup reads a consistent database snapshot; it never treats Google Drive as the live ledger database.

Suggested project layout:

```text
src/
  app/                 # Boot, navigation, providers, migration gate
  features/            # Transactions, accounts, calendar, reports, budgets
  components/          # MoneyInput, cards, chart wrappers, empty states
  domain/              # Models, calculation rules, use cases
  data/                # SQLite schema, migrations, repositories
  services/            # Backup, Drive, ads, notifications, secure storage
  theme/               # Colors, typography, spacing, accessibility
  utils/               # Formatting and non-domain helpers
tests/
android/
ios/
```

## 5. Database and monetary correctness

Use UUIDs for records. Store money as integer minor units with an explicit ISO currency code and currency exponent. Do not use floating-point values for amounts. Reject amounts outside JavaScript’s safe-integer range unless the entire calculation/storage boundary uses a tested bigint representation. Parse decimal input exactly; account for currencies with zero or three decimal places.

MVP uses one currency across accounts, budgets, and transactions. Phase 2 requires currency-specific totals or explicit conversion rates and rounding rules. Never sum different currencies directly.

### Core tables

| Table | Essential fields |
|---|---|
| `accounts` | id, name, type, currency, opening_balance_minor, archived_at |
| `categories` | id, name, expense_or_income, icon, color, parent_id, archived_at |
| `transactions` | id, type, amount_minor, currency, account_id, category_id, occurred_at_utc, local_date, timezone_id, note, transfer_id, refund_of_id, recurrence_occurrence_key |
| `transfers` | id, from_account_id, to_account_id, amount_minor, currency, occurred_at_utc |
| `tags` / `transaction_tags` | Tag records and transaction/tag membership |
| `daily_notes` | id, local_date, body |
| `budgets` | id, scope, category_id, currency, amount_minor, period, start_date |
| `recurring_rules` | id, transaction_template, interval, next_due_date, end_date, entry_mode |
| `goals` / `goal_contributions` | Targets and allocation records; Phase 2 |
| `debts` / `debt_payments` | Principal, direction, due date, linked transaction IDs; Phase 2 |
| `attachments` | id, transaction_id, private_file_path, content_hash, byte_size; Phase 2 |
| `preferences` | Locale, theme, reminders, reporting timezone, balance visibility |
| `backup_state` | Account binding, dataset_id, last_success_at, snapshot_id, pending changes |

Mutable domain records also have created_at, updated_at, revision, and deleted_at fields. Use soft deletion for undo and future merge support. Do not purge tombstones before a defined retention/sync policy makes it safe. Derived chart totals and balances are not primary records.

Enable foreign keys and use schema constraints: positive amounts, valid transaction types, valid account references, and unique recurrence occurrence keys. Transfers have exactly two linked legs under one transfer ID and one atomic write; exclude both legs from income/expense reports. Disallow hard deletion of referenced categories/accounts; archive them instead.

Account balance = opening balance + income + refunds + transfer-in − expenses − transfer-out. A credit-card account represents signed net balance, where a negative balance means money owed. Card purchases are expenses; card repayments are transfers, preventing double-counting.

### Dates and queries

Preserve the user’s chosen transaction date as `local_date` for calendar/report grouping, alongside its UTC instant and timezone. Travel or device timezone changes must not move past transactions to another day silently. Recurrence uses calendar dates, not fixed 24-hour increments. Test daylight-saving transitions, leap days, month ends, and locale-specific week starts.

Index transactions by local_date, account/date, category/date, and updated_at; index tag membership. Use full-text search for notes if necessary. Aggregate in SQL and paginate large lists. Apply the same date/refund/transfer rules in dashboard, charts, calendar, and exports.

### Migrations

Version schema migrations, run them transactionally where supported, and make a recovery copy before destructive changes. Validate counts and constraints after migration. If migration fails, preserve the original database and show a recovery path; never silently reset it. Reject a backup from an unsupported newer schema version.

## 6. Offline behavior and durability

Transaction writes commit locally before showing success. Ads, Google sign-in, backup, and optional online features must never block ledger use. Display pending backup changes separately from saved transactions.

Use database transactions, a consistent SQLite snapshot/export mechanism, checksums, and app-private file storage. Do not copy only the SQLite main file while WAL writes are active. Handle low-storage errors without displaying false success. Close/reopen and integrity-check restored databases before using them.

The app works when force-closed and reopened offline. Clearly explain that uninstalling or losing a device can remove local-only data. Expose export and backup from Settings and provide optional, dismissible reminders when backup is disabled.

## 7. Google backup, restore, and future sync

### MVP: automatic backup and explicit restore

“Connect Google” means optional Google sign-in and private app-data snapshots in the user’s Google Drive. It does not mean Firebase is required, and signing in alone does not make backup successful. MVP is backup/restore, not concurrent multi-device editing.

Request only the required Drive app-data scope. Register Android/iOS OAuth clients, production signing certificates, and any required consent verification. Never embed a client secret in the app. Use the library’s supported token renewal path, redact credentials from logs, and keep account/permission failures separate from generic network errors.

Backup Settings shows the connected Google account, last successful backup, pending local changes, backup size, automatic backup setting, Back up now, Restore, and Disconnect. Display “Backup needs attention” with a specific recovery action when authentication or upload fails.

### Encryption and recovery

Encrypt archives on the device with an authenticated encryption scheme such as AES-256-GCM through a reviewed native crypto implementation. Generate a random data key and unique nonce per encryption. Store a local key copy in Keychain/Keystore. For another device to restore, also wrap the key using a user recovery passphrase or exported recovery key. A key stored only on the old device cannot protect against device loss while still enabling recovery.

For passphrases, use a reviewed password KDF with a random salt and parameters benchmarked on supported phones. Record the KDF version/parameters in the archive. Explain that Google login does not recover a forgotten recovery secret. Never upload a plaintext encryption key next to the archive. An encrypted backup does not by itself encrypt the live SQLite database.

Archive metadata includes format/schema versions, snapshot ID, dataset ID, device ID, timestamp, app version, currency, payload size/checksum, and encryption/KDF parameters. Encrypt financial payload and attachments. Do not include OAuth tokens, biometric secrets, ad consent decisions, or device-specific notification identifiers.

### Upload protocol

1. Capture a consistent local snapshot and its local revision watermark.
2. Validate, compress, encrypt, and checksum it in app-private temporary storage.
3. Upload a new immutable snapshot to Drive appDataFolder.
4. Verify remote completion and uploaded bytes/hash before marking success.
5. Update local backup state only after verification; clear pending changes only through the captured watermark.
6. Retain a bounded history, for example seven daily plus four weekly recovery points, subject to quota and user deletion settings. Prune only after a new snapshot succeeds.

Debounce changes and attempt upload on foreground/resume and user action. Use platform background work where available, but disclose that OS scheduling can delay backups. Retry transient failures with bounded exponential backoff. Preserve the last good snapshot after failures. Handle Drive quota, token revocation, account switching, no network, and low device storage explicitly.

### Restore protocol

1. List snapshots for the chosen dataset/account with dates and compatibility.
2. Download into temporary private storage; impose archive size and decompression limits.
3. Authenticate/decrypt, verify checksums, validate schema/references, and migrate a temporary database.
4. Show a preview with record counts, covered date range, and backup timestamp.
5. Explain that MVP restore replaces current data; require explicit confirmation and make a local safety snapshot first.
6. Pause writes, checkpoint/close the current DB, perform a journaled atomic replacement, reopen, and verify integrity. On failure, recover the original DB.
7. Rebuild notifications and caches; show the restored dataset and retain a recoverable safety snapshot.

MVP does not merge restored records with current records. Disconnecting Google stops uploads but preserves local data; deleting remote backups is a separate explicit action. Switching Google accounts requires a deliberate dataset/account binding choice. Detect snapshots from another device and warn before enabling uploads to an existing dataset; avoid a “latest backup” pointer that silently discards other devices’ histories.

### Phase 3: actual multi-device sync

Add a durable change log, stable entity IDs, device IDs, per-record revisions, deletion tombstones, idempotent batches, and a durable server-side merge protocol. A sync backend such as an authenticated API with a transactional store is preferable to pretending Drive snapshot replacement is record sync.

Specify and test conflicts: concurrent edits to one transaction, edit-versus-delete, category changes, duplicate recurrence occurrences, and transfer updates. Resolve financial conflicts visibly; do not silently rely on device clocks or last-write-wins. Treat transfers as one aggregate. Encrypt synced payloads with a documented device key-sharing and recovery flow. This is a separate product/security phase.

## 8. Advertising and privacy

Use Google Mobile Ads with test unit IDs during development. Separate Android/iOS IDs by build configuration. Online ad availability is optional; collapse failed placements cleanly offline. Load SDK ads only after applicable consent decisions and platform permissions have been handled. Configure Google’s consent SDK and an accessible privacy-options entry point where required. Request iOS tracking permission only if the configured advertising behavior actually requires it.

Start with a small banner on Home or the transaction list. No interstitials in transaction entry, restore, backup, onboarding, or immediately after saving. A later native placement may be added after measuring usability. Consider an optional paid ad-removal product without restricting core offline finance features.

Publish a privacy policy, accurate App Store privacy labels and Google Play Data Safety declarations, and a consent policy appropriate to release regions. Distinguish device-local finance data, user-enabled Drive backup, and advertising SDK collection. Financial information must not become ad targeting or analytics attributes.

## 9. Security, permissions, and exports

- Optional biometric/app lock uses native authentication; an app lock alone is not database encryption.
- Keep files in app-private storage and secrets in secure storage. Decide explicitly whether OS device backups can include the database; avoid unplanned cloud copies.
- Redact transaction data, tokens, passphrases, and notes from crash logs. Analytics, if added, record coarse UI events only with a documented preference.
- Request notifications when enabling reminders, photo access when attaching receipts, and Google access when enabling backup.
- Provide local encrypted backup export/import even without Google. CSV exports are plaintext: explain this at export, use system share/save UI, and remove temporary files promptly.
- Neutralize spreadsheet formula injection in CSV text fields and validate imported types, currencies, duplicates, sizes, and references before writing.
- Provide Delete local data and Delete Google backups as distinct actions with explicit consequences.
- Assess screen capture/privacy-screen behavior per platform without promising universal screenshot blocking.

## 10. Reliability, performance, and testing

Proposed performance targets must be measured on a named mid-range reference device and release build: local save under 150 ms at p95, common filtered views under 500 ms at p95, and a usable first screen within two seconds after initialization. Validate with at least 100,000 transactions. Perform expensive export/encryption work outside interactive UI execution where the selected libraries allow it.

Critical verification:

- Money parsing, refunds, net spending, balances, transfers, card repayment, budgets, and zero-income calculations.
- Calendar/report agreement, date boundaries, leap years, daylight saving, and locale formatting.
- Atomic writes under interruption; no duplicates after rapid Save taps or recurring-job retries.
- Fresh install and upgrades from every supported schema fixture; failed migrations preserve data.
- Backup round-trip including attachments; wrong key, tampered archive, truncated upload, quota failure, account switch, and unsupported schema.
- Restore interruption and rollback; changes made during backup remain pending afterward.
- Full transaction/report flows in airplane mode; denied notification permission and failed ad loading.
- VoiceOver/TalkBack, large text, dark mode, and chart text alternatives.
- Native release builds on Android/iOS using production signing/OAuth configuration and test ads during validation.

CI runs type checks, lint, domain/repository tests, migration tests, and critical UI journeys. Maintain native release build checks. Use crash reporting only after verifying redaction; operational metrics must not contain financial payloads.

## 11. Delivery sequence

1. **Foundation:** native project, TypeScript, navigation, design tokens, SQLite schema, migration runner, exact money/date utilities.
2. **Core ledger:** accounts/categories, expense/income/refund entry, atomic transfers, history, search, daily notes.
3. **Insights:** dashboard, consistent filters, calendar, charts, accessible report tables, monthly budgets.
4. **Data protection:** local exports, recovery-key UX, encrypted Drive snapshots, restore preview/rollback, failure states.
5. **Monetization and release:** ad consent, restrained placements, privacy settings, accessibility/performance validation, signed store builds.
6. **Expansion:** recurring bills, savings goals, debts, receipts, reports, advanced budgets, and eventually device sync.

### MVP acceptance criteria

- A new user can create an account and record an expense without login or internet access.
- Income, expenses, refunds, and transfers produce correct balances and report totals.
- Selecting a calendar day shows exactly the transactions contributing to that day’s totals.
- Filtered chart totals match the filtered transaction list.
- Editing, deleting, or undoing a transaction updates all affected views consistently.
- Monthly budgets show correct progress and never duplicate threshold notifications.
- A user can export locally and restore a compatible encrypted backup on a fresh installation with the recovery secret.
- Google backup verifies a new snapshot before showing success; failures preserve prior recovery points.
- Restore previews the replacement and preserves the existing database if validation or replacement fails.
- Airplane mode supports all core ledger, calendar, budget, and reporting workflows.
- Advertising does not interrupt money entry or recovery and receives no financial payloads.

## 12. Decisions to confirm before implementation

Default assumptions: Android and iOS, single personal ledger, one currency in MVP, five-tab navigation, free app with restrained ads, optional Google Drive backup, explicit restore, and no bank integrations.

Confirm the release market and initial languages, minimum supported OS versions, default currency, brand/name/icon, database-at-rest encryption requirement, and recovery-secret UX. Decide whether paid ad removal belongs in the first release. If seamless simultaneous device editing is required at launch, promote the sync phase into MVP and budget for its backend and conflict workflows.
