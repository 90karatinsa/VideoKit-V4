# Intl Number/Date Usage Issues

## Summary of Findings
| ID | Location | Issue | Recommended Fix |
| --- | --- | --- | --- |
| 1 | `app.js` line 555 | `toFixed(1)` forces US decimal separator when rendering success rate percentages. | Use `Intl.NumberFormat(i18n.currentLang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })` (or a percent formatter) to build the label. |
| 2 | `tool.html` lines 327-330 & 645-648 | `fmtSize` helpers rely on `toFixed(1)` and hard-coded units, producing US-style decimals in the UI and exported PDF. | Replace with `Intl.NumberFormat` using the active UI locale and consider localizing unit labels (`KB`, `MB`, `GB`). |
| 3 | `tool.html` lines 383 & 666 | Durations are interpolated via raw `${report.ms + ' ms'}` strings without locale-aware formatting. | Format the milliseconds with `Intl.NumberFormat` and source the unit from translations. |
| 4 | `tool.html` line 649 | `new Date().toISOString()` string is reused as "YYYY-MM-DD HH:MM:SS UTC" in the PDF, bypassing locale and time-zone friendly output. | Format with `Intl.DateTimeFormat` specifying `timeZone: 'UTC'` and the active locale. |

## Detailed Notes & Patch Plan

### 1. Success rate percentage uses `toFixed`
* **Details:** Analytics summary builds the success percentage using `${successRate.toFixed(1)}%`, which always renders a dot as decimal separator regardless of the selected locale.【F:app.js†L548-L557】
* **Plan:**
  1. Add a reusable `formatPercent` helper that leverages `Intl.NumberFormat` with `minimumFractionDigits`/`maximumFractionDigits` and divides by 100 if using `style: 'percent'`.
  2. Replace the `toFixed` usage with the helper and source the percent sign from translations if necessary.

### 2. File-size helpers rely on `toFixed`
* **Details:** Both UI and PDF `fmtSize` helpers call `toFixed(1)` and concatenate English unit suffixes, which introduces dot decimals for Turkish users.【F:tool.html†L327-L330】【F:tool.html†L645-L648】
* **Plan:**
  1. Refactor the formatter to compute the numeric value but render it through `Intl.NumberFormat` with one fractional digit.
  2. Localize the unit labels either via an existing `i18n` dictionary or a simple lookup keyed by locale.
  3. Reuse the same formatter across UI and PDF code paths to keep behavior consistent.

### 3. Millisecond durations are concatenated without localization
* **Details:** The UI cards and generated PDF insert durations using `${report.ms+' ms'}` without locale-aware formatting or translated units.【F:tool.html†L372-L389】【F:tool.html†L666-L667】
* **Plan:**
  1. Introduce a `formatMilliseconds` helper that uses `Intl.NumberFormat` to render the numeric part.
  2. Fetch the localized "ms" label from translations (or add one) before concatenation.
  3. Apply the helper everywhere durations are rendered.

### 4. PDF approval timestamp is ISO string
* **Details:** The approval timestamp shown in the PDF is created via `new Date().toISOString().replace('T',' ').split('.')[0] + ' UTC'`, which ignores locale-specific date/time shapes.【F:tool.html†L645-L649】
* **Plan:**
  1. Replace the manual string manipulation with `Intl.DateTimeFormat`, passing `{ dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC' }`.
  2. Ensure the formatter is initialized with the currently selected locale so that Turkish users see day/month ordering and comma usage expected in TR.

## Next Steps
Implementing the patch plan will align numeric and date outputs with the active locale (notably Turkish), eliminate dot-based decimals, and avoid ISO strings leaking into the UI. After applying fixes, retest analytics dashboards and PDF exports under the Turkish locale to verify correct separators and labels.
