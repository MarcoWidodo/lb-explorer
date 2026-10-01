# Engine changes (port back to ABS Explorer)

The LB Explorer was seeded from `MarcoWidodo/abs-explorer@9c4ed87` (branch `v2`). Survey-specific code
(`pipeline/R/00_config.R`, `10_catalogue.R`, `40_indicators.R`, `pipeline/config/`, the views' data loading,
text and colour tokens) is expected to differ. This file lists changes to **shared engine code** that
ABS could adopt. Each entry says whether it is backward compatible.

| # | File | Change | ABS impact |
|---|---|---|---|
| 1 | `src/lib/stats.js` | `regionValue(byCountry, members, allowMissing = false)`: optional unbalanced mode (average of members with data, `n_countries` returned). | Compatible (default unchanged). |
| 2 | `src/components/charts/LineChart.jsx` | New props `xDomain`, `xTicks`, `minorTicks` (tick marks at every survey year so gap years show); points may carry `subtitle` and `extraRows` for the tooltip (e.g. base, number of countries). | Compatible. |
| 3 | `src/components/shared/Controls.jsx` | `WaveSelector` switches to a new `YearSelector` (calendar strip with gap years, `<select>` under 760 px) when the manifest has more than 8 units; both take `available` to disable units without data. `BaseControl` text comes from `manifest.survey.nr_text`. `BreakdownControl` shows the subgroup's `note`. | Compatible (ABS has 6 waves; set `nr_text` or keep the fallback). |
| 4 | `src/lib/exporter.js` | `TIDY_COLUMNS` now follows instructions rule 9 without `wave`; `TIDY_COLUMNS_WAVES` keeps it. Values are rounded on export: shares 1 decimal, means 3 (`tidyRound`). | ABS views should pass `TIDY_COLUMNS_WAVES` to keep the `wave` column. |
| 5 | `src/lib/indicators.js` | `defaultIndicator(rec, entry)` uses the catalogue's pipeline default (`entry.d`) when present; `meanAllowed(rec, entry)` honours `entry.m`. | Compatible (falls back to the old rules). |
| 6 | `src/components/shared/WaveDotMatrix.jsx` + CSS | Dense mode for many units: calendar columns with thin gap columns, horizontal scroll inside the box on phones. | Compatible (only when > 8 units). |
| 7 | `src/components/shared/DetailPanel.jsx` | `countriesLabel` prop; new `QuestionHistory` (years asked, question number per year, comparability notes). | Compatible. |
| 8 | `src/components/layout/Header.jsx` + CSS | Optional banner from `manifest.survey.preview_notice`. | Compatible. |
| 9 | `src/context/DataProvider.jsx` | `useSourceNote({ gaps })` appends `manifest.gaps_note`; base wording from `nr_text`; `unit` / `years` helpers; `waveLabel` drops the year range when the unit is a year. Data paths are LB's layout (below). | Paths are survey-specific; the helpers are compatible. |
| 10 | `src/views/CorrelationsExplorer.jsx` | Across-country scatter plots each question's **default summary** (a mean only for interval-like scales, else the top-category share), not always the mean, per instructions rule 7. | Recommended for ABS too (it plotted means of 4-point items). |
| 11 | `pipeline/build_site_data.Rmd` | A country-year in which every answer is nonresponse is **not published** (it is a question not asked there, e.g. armed forces in Costa Rica/Panama). Listed in `output/nonresponse_only_country_years.csv`. | Worth checking ABS for the same pattern. |
| 12 | `pipeline/build_site_data.Rmd` | Subgroup cells are slimmed (no per-code counts or SD; Kish N rounded) and stored one file per year; correlation files store pairwise N as `n0` (valid N of the focal item) minus `dn`. Cuts payload by about a third. | Schema change; ABS front end reads the old fields. |
| 13 | `pipeline/R/10_catalogue.R` (LB) | 0–10 / 1–10 scales labelled only at the ends are ordinal even when the end labels are not scale words ("Left" … "Right"). | Same rule would be safe in ABS. |

## Data layout (LB)

LB variables are harmonised across years, so one file per question covers every year:
`v/<var>.json` (all respondents, all years; trends, map and single-year view share one fetch),
`g/<year>/<var>.json` (subgroups, on demand), `r/<year>/index.json` + `r/<year>/<var>.json` (correlations),
`index.json` (catalogue with years, type, default indicator, comparability notes).
