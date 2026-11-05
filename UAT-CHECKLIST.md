# Walletway 0.4.0 UAT — requirement coverage

The consolidated Android code is on `main`. Android uses Excel backup and import.

## Available for Android UAT

- Expense/income/refund/transfer CRUD, duplicate/undo, tags and exact minor-unit amounts.
- Quick-entry templates, recent categories, last payment account, optional-details expansion.
- Combined date/time field, current time, 12-hour clock dial; stable local-date grouping with recorded timezone/instant on new manual entries.
- Approved blue logo and Walletway – Money Management name.
- Reorderable categories, plus tile, editable names/colors and more icons.
- Offline cash/card/bank/wallet accounts, opening balances and archives.
- Dashboard with saved balance visibility and configurable summary-card order.
- Statistics filters, category donut, negative-refund table, trend, income/expense bars, previous equal-length period, cumulative spending, heatmap and weekly totals.
- CSV and paginated PDF report exports with explicit plaintext warning.
- Calendar fitting all seven columns, swipe/arrow month changes, daily income/spending, agenda view, journal, net cash flow and scheduled-item display.
- Monthly/weekly/custom budgets, category/tag scopes, signed rollover, configurable warning threshold and 100% alert. Notification markers persist per ledger/budget/period/threshold.
- Daily evening reminders, default 8 PM, selectable 12-hour time. Android AlarmManager + NotificationManager; no reminder service or third-party reminder library. Reboot/timezone/time-change rescheduling, runtime notification permission and denied-permission handling. Android can delay delivery; force-stopping the app blocks alarms until it is reopened.
- Recurring daily/weekly/monthly/yearly rules with reminder-only default, automatic-on-open mode, unique occurrence IDs, preserved month-end anchor, end date and large-backlog review.
- Debts and repayments represented by atomic transfers to receivable/liability accounts; excluded from income/spending. Debt-linked transfers cannot be edited/deleted arbitrarily.
- Goal contribution/withdrawal history without creating spending.
- Private receipt-image picker (5 MB per image); Excel backup inclusion (12 MB combined receipts).
- Separate local currency ledgers (USD/INR/EUR/GBP/AUD/CAD); explicit-rate conversion calculator, no silent exchange or mixed-currency sums. Excel backups cover the selected currency ledger.
- Light/dark/system themes, primary colors, locale money formatting, configurable week start, reduced-motion month navigation, improved contrast and 48 dp chips.
- Native biometric/device-credential app lock, local-data deletion for selected ledger, internal pre-restore safety copies.
- Additive schema v2 transaction indexes with foreign-key references; v2 exports with compatible v1 archive imports; transactional restore and attachment cleanup on failure.
- Google test banners retain consent gating. Extra ad text, local demo preview and advertising settings controls have been removed. Real AdMob IDs and consent messages remain unconfigured.
- Development signing key reuse from previous available artifacts. This is not production signing; preserve the key before artifact expiry.

## Verification included

CI checks TypeScript, SQLite restore rollback, recurrence, debt transfers, currency ledgers and receipts. Android checks the backup screen and workbook codec, including multi-cell payloads and damaged files.

## Acceptance work still required

These must not be described as completed production features:

- iOS native project/build and VoiceOver/native permission validation: not part of this Android APK.
- Phase 3 simultaneous multi-device sync/conflict resolution: requires a backend and a defined key-sharing protocol; no service is fabricated.
- Store publication, owner contact/privacy URL, production signing secrets, live AdMob IDs/messages and store disclosures: require owner configuration. PRIVACY-POLICY.md is a review draft, not a published legal policy.
- Physical-device notification timing, large-text/TalkBack journeys, receipt picker and biometrics must be tested on supported devices.
- 100,000-record performance targets on a named mid-range phone remain unmeasured. Ledger calculations still load records into memory; indexes alone do not prove latency targets.
- Five Java scheduling tests and four Android device tests cover midnight/DST, native snapshot receipts, safe path handling and scheduled-job cancellation. Real-account access, overnight device behavior and power-management delays still need acceptance.
- Background automatic entry is intentionally not promised. Automatic recurrence catches up on open; local alerts can be delayed by Android.
- Live SQLite storage is not encrypted at rest. App lock does not change that.
- Excel backups and scheduled local reminders are per selected currency ledger. Notification threshold markers are retained across switches. Recovery copies remain private plaintext; Excel exports are the portable recovery method.
