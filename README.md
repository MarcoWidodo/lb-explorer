# Asian Barometer Survey Explorer (v2)

Interactive explorer for the Asian Barometer Survey, Waves 1–6 (2001–2023): response distributions, harmonized time series, maps and correlations, with subgroup breakdowns and print-ready exports.

Live site: <https://abs-explorer-sigma.vercel.app>

The site is a static React app. **Every number it shows is computed in R** by `pipeline/build_site_data.Rmd` and written to `public/data/` as small JSON files, one per question. The browser only fetches the files a view needs.

```
pipeline/                    R pipeline: .sav → public/data (knit this to rebuild the data)
  build_site_data.Rmd        the build, with every check as a stopifnot()
  R/00_config.R              everything survey-specific: paths, waves, weights, subgroups, country sets
  R/10_catalogue.R           response-code and question-type classification
  R/20_estimates.R           weighted distributions, means, SEs by country × subgroup
  R/30_correlations.R        weighted pairwise correlations within each country
  R/40_trends.R              harmonized series from HarmonizedMerge_v1 + the crosswalk
  config/*.csv               countries, questionnaire sections, overrides, fieldwork-year fallbacks
  output/catalogue_review.csv  how every variable was classified (review this after a rebuild)
  verify_site_data.py        independent re-computation of a random sample of published numbers
public/data/                 generated; do not edit by hand
src/                         React front end (Vite)
  lib/stats.js               the only statistics done in the browser (re-basing, regional means, p-values)
  lib/exporter.js            SVG / 300-dpi PNG / tidy-CSV export
  components/charts/         the chart components (plain SVG + d3-scale)
scripts/build-geo.mjs        builds the two map files from Natural Earth (world-atlas)
```

## Rebuilding the data

Needs R ≥ 4.3 with haven, readxl, dplyr, tidyr, purrr, data.table, jsonlite and rmarkdown, and the `Asian Barometer Data` folder downloaded locally (not iCloud placeholders).

```r
setwd("pipeline")
Sys.setenv(ABS_DATA_DIR = "~/Desktop/Larry RA/Asian Barometer Data")
rmarkdown::render("build_site_data.Rmd")   # ~12 minutes; a finished knit means every check passed
```

The build writes to a staging folder and only replaces `public/data/` after all checks pass. Then optionally:

```bash
ABS_DATA_DIR=".../Asian Barometer Data" python3 pipeline/verify_site_data.py 400
```

To change how a question is treated, edit the crosswalk (harmonized series) or `pipeline/config/variable_overrides.csv` (single-wave question types), then re-knit.

## Running the site locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Deploying

The Vercel project `abs-explorer` builds from this GitHub repository. Pushing a branch creates a preview deployment; merging into `main` updates the live site.

## Data and citation

Asian Barometer Survey, Waves 1–6, <https://www.asianbarometer.org>. The survey's terms of use apply; this site publishes only aggregate estimates, never respondent-level data.
