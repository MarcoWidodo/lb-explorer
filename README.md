# Latinobarómetro Explorer

Interactive explorer for Latinobarómetro 1995–2024 (24 survey years, 18 Latin American countries): response distributions, trends on a real year axis with regional averages over fixed country sets, maps and correlations, with subgroup breakdowns and print-ready greyscale exports with tidy CSVs.

**Status: private preview.** Latinobarómetro's terms prohibit republishing its data on other websites ("Se prohíbe la redistribución: volver a publicar datos del Latinobarómetro en otros sitios web infringe el derecho de propiedad de Latinobarómetro", latinobarometro.org/agregados). Keep this repository and the deployment private until the Corporación Latinobarómetro has agreed to a public release.

Built on the ABS Explorer v2 engine (seeded from `MarcoWidodo/abs-explorer@9c4ed87`). Fixes to shared engine code are logged in [`ENGINE_CHANGES.md`](ENGINE_CHANGES.md) so they can be ported back.

The site is a static React app. **Every number it shows is computed in R** by `pipeline/build_site_data.Rmd` from `LB_TimeSeries_Clean_v1.sav` and written to `public/data/` as small JSON files. The browser only fetches the files a view needs.

```
pipeline/                    R pipeline: LB_TimeSeries_Clean_v1.sav → public/data (knit this to rebuild the data)
  build_site_data.Rmd        the build, with every check as a stopifnot()
  R/00_config.R              everything survey-specific: paths, years, weight, subgroups, country sets
  R/10_catalogue.R           response-code and question-type classification (LB rules)
  R/20_estimates.R           weighted distributions, means, SEs by country-year × subgroup (engine)
  R/30_correlations.R        weighted pairwise correlations within each country-year (engine)
  R/40_indicators.R          default summaries, comparability breaks, crosswalk question numbers
  config/*.csv               countries, core trend indicators (instructions §5), trend breaks, type overrides
  output/                    review tables: catalogue_review.csv, nonresponse_only_country_years.csv,
                             region_reference.csv, file_sizes.csv
  verify_site_data.py        independent Python re-computation of a random sample of published numbers
  check_regions.mjs          the site's own JavaScript regional lines vs lb_region()
public/data/                 generated; do not edit by hand
  manifest.json, index.json  start-up metadata and the question catalogue
  v/<var>.json               all respondents, every year
  g/<year>/<var>.json        subgroups, one year (loaded on demand)
  r/<year>/<var>.json        within-country correlations, one year
src/                         React front end (Vite)
  lib/stats.js               the only statistics done in the browser (re-basing, sums, regional means, p-values)
  lib/exporter.js            SVG / 300-dpi PNG / tidy-CSV export
scripts/build-geo.mjs        builds the two map files from Natural Earth (world-atlas)
```

## Rules

The pipeline and the views follow `Latinobarometro Data/Data Cleaning/LB_Trend_Analysis_Instructions.md`, and source `LB_functions.R` from that folder: the clean file only; always weighted (`weight`); valid and asked denominators (−1/−2/−5 = don't know / no answer, every other negative code = not asked); country-year estimates first, then equal-weight regional means over fixed sets shown only when every member has data; a real calendar-year axis with no interpolation; comparability breaks (left–right 1998, `I_005_001` 2003, `E_001_*` 1996/2003/2006, `I_001_001`) never bridged; means only for interval-like scales; a tidy CSV with every chart.

## Rebuilding the data

Needs R 4.3 with haven, readxl, dplyr, tidyr, purrr, data.table, jsonlite and rmarkdown (reference: R 4.3.3, haven 2.5.4, data.table 1.14.10, jsonlite 1.8.8), ~6 GB RAM, and the `Latinobarometro Data` folder downloaded locally (`LB_TimeSeries_Clean_v1.sav`, `time-series-harmonization-crosswalk.xlsx`, `Data Cleaning/`).

```r
setwd("pipeline")
Sys.setenv(LB_DATA_DIR = "~/Desktop/Larry RA/Latinobarometro Data")
rmarkdown::render("build_site_data.Rmd")   # about an hour; a finished knit means every check passed
```

The build writes to a staging folder and only replaces `public/data/` after all checks pass. Then:

```bash
LB_DATA_DIR=".../Latinobarometro Data" python3 pipeline/verify_site_data.py 600
node pipeline/check_regions.mjs
```

`LB_BUILD_YEARS="1995,2010,2024"` builds a subset of years (for testing or measuring payload size).

## Running the site locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Deploying

A Vercel project builds from this repository (Vite preset). Pushing a branch creates a preview deployment behind Vercel Authentication.

## Data and citation

Corporación Latinobarómetro, Latinobarómetro 1995–2024, <https://www.latinobarometro.org>. Use is free for non-commercial research, teaching and publications; redistribution is prohibited. This site publishes only aggregate estimates, never respondent-level data.
