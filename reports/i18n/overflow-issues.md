# Pseudo-Locale Overflow & Layout Review (en-XA)

## Captured mock screens
- `screenshots/i18n/login.png`
- `screenshots/i18n/register.png`
- `screenshots/i18n/dashboard.png`
- `screenshots/i18n/analytics.png`
- `screenshots/i18n/batch.png`

> **Note:** The screenshots are pseudo-locale mockups generated from the translation file because Playwright/browser dependencies
> could not be installed in the offline container. They still surface the expanded string lengths that the UI needs to absorb.

## Observations & Risks

1. **Dashboard tenant heading cannot wrap.** The `tenant_display_text` string now injects an expanded tenant ID and plan name, which
together exceed the available width in the dashboard header without any `word-break` fallback. 【F:locales/en-XA.json†L54-L54】【F:index.html†L115-L134】
   - *Recommendation:* allow the heading to wrap (e.g., `word-break: break-word`) or move tenant metadata below the heading.

2. **API key labels overflow the card.** Long masked key labels such as
   `vk_live_super_massive_identifier_extremely_long` extend beyond the flex row because `.api-key-value` lacks wrapping rules.
   This was reproduced with the mocked analytics run. 【F:tests/e2e/i18n-screenshots.spec.mjs†L200-L218】【F:style.css†L420-L438】
   - *Recommendation:* add `word-break: break-all;` or `overflow-wrap: anywhere;` to `.api-key-value` and consider constraining
the action buttons with wrapping support.

3. **Batch processing summary row cannot contain long labels.** The summary banner keeps `display: flex` with no wrapping, so
pseudo-locale labels for upload counts plus the "Download All Reports" CTA spill horizontally when rendered together.
【F:locales/en-XA.json†L28-L35】【F:batch.css†L32-L41】
   - *Recommendation:* enable wrapping on `.batch-summary` (e.g., `flex-wrap: wrap`) and adjust spacing to accommodate multi-line content.

4. **Analytics activity types risk clipping.** The mocked analytics feed contains operation names that exceed the default cell width
(e.g., `c2pa.verify.single.longassetname.with.extensions`). Without word-breaking, the activity column will stretch the table on
smaller screens. 【F:tests/e2e/i18n-screenshots.spec.mjs†L221-L257】【F:style.css†L583-L599】
   - *Recommendation:* apply `word-break: break-word;` on `.activities-table td` or clamp the column width with ellipsis support.

Addressing these issues will reduce the chance of pseudo-locale text pushing key controls off-canvas or creating horizontal scroll bars.
