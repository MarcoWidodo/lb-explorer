# =============================================================================
# 00_config.R: everything survey-specific lives here (plus pipeline/config/*.csv)
#
# Latinobarómetro edition of the barometer-explorer engine (seeded from the
# ABS Explorer v2 pipeline). The estimation code in 20–50_*.R is unchanged
# survey-agnostic engine code; LB-specific rules sit here and in 10_catalogue.R.
# =============================================================================

SURVEY <- list(
  id          = "lb",
  name        = "Latinobarómetro",
  short       = "LB",
  region      = "Latin America",
  url         = "https://www.latinobarometro.org",
  attribution = paste(
    "Latinobarómetro is produced by the Corporación Latinobarómetro, a non-profit organisation",
    "based in Santiago, Chile."),
  citation    = paste(
    "Corporación Latinobarómetro, Latinobarómetro 1995–2024 (time-series merge), www.latinobarometro.org.",
    "Cleaned and harmonised for this site from LB_TimeSeries_Clean_v1."),
  unit_label  = "Year",
  nr_text     = "Don't know / no answer",
  contact     = "widodomarco@gmail.com",
  # shown as a banner on every page until Corporación Latinobarómetro agrees to public release
  preview_notice = paste(
    "Private preview for the research team. Latinobarómetro's terms prohibit republishing its data on other websites;",
    "do not share this site publicly without the Corporación Latinobarómetro's permission.")
)

# ---- Paths -------------------------------------------------------------------
# LB_DATA_DIR: the "Latinobarometro Data" folder, holding LB_TimeSeries_Clean_v1.sav,
# time-series-harmonization-crosswalk.xlsx and "Data Cleaning/" (LB_functions.R,
# the variable catalog and the country-year table). Downloaded locally, not
# iCloud placeholders. Set with Sys.setenv(LB_DATA_DIR = "...") before knitting.
DATA_DIR     <- Sys.getenv("LB_DATA_DIR", unset = "~/Desktop/Larry RA/Latinobarometro Data")
CLEAN_FILE   <- file.path(DATA_DIR, "LB_TimeSeries_Clean_v1.sav")
CLEANING_DIR <- file.path(DATA_DIR, "Data Cleaning")
LB_FUNCTIONS <- file.path(CLEANING_DIR, "LB_functions.R")
CATALOG      <- file.path(CLEANING_DIR, "LB_TimeSeries_Clean_v1_variable_catalog.csv")
COUNTRY_YEAR <- file.path(CLEANING_DIR, "LB_TimeSeries_Clean_v1_country_year.csv")
CROSSWALK    <- file.path(DATA_DIR, "time-series-harmonization-crosswalk.xlsx")

CONFIG_DIR <- file.path(PIPELINE_DIR, "config")
OUT_DIR    <- file.path(PIPELINE_DIR, "..", "public", "data")   # site data
REVIEW_DIR <- file.path(PIPELINE_DIR, "output")                 # review tables

# Build only some years (for measuring payload size on a subset). Empty = all.
BUILD_YEARS <- as.integer(strsplit(Sys.getenv("LB_BUILD_YEARS", ""), "[, ]+")[[1]])

# ---- Units: survey years ---------------------------------------------------------
# One unit per survey year; the unit id is the year itself. LB_SURVEY_YEARS comes
# from LB_functions.R. No survey in 1999, 2012, 2014, 2019, 2021, 2022.
SURVEY_GAPS_NOTE <- "No surveys in 1999, 2012, 2014, 2019, 2021–22."
WEIGHT_VAR <- "weight"        # = X_020, mean 1 within each country-year

# ---- Variables that are never shown (identifiers, weights, design) -------------
ADMIN_VARS <- c("resp_id", "year", "country_code", "country", "iso3", "weight",
                "X_003", "X_004", "X_008")

# ---- Subgroups --------------------------------------------------------------------
SUBGROUPS <- list(
  list(id = "gender", label = "Gender", source = "S_001",
       groups = list(list(id = "men",   label = "Men",   codes = 1),
                     list(id = "women", label = "Women", codes = 2))),
  list(id = "age", label = "Age", source = "S_002",
       groups = list(list(id = "age18", label = "Under 30", range = c(0, 29)),
                     list(id = "age30", label = "30–44",    range = c(30, 44)),
                     list(id = "age45", label = "45–59",    range = c(45, 59)),
                     list(id = "age60", label = "60+",      range = c(60, 120)))),
  list(id = "edu", label = "Education", source = "S_101",
       groups = list(list(id = "edu_low",  label = "Primary or less",          codes = 1:3),
                     list(id = "edu_mid",  label = "Secondary or technical",   codes = 4:5),
                     list(id = "edu_high", label = "Higher (some or complete)", codes = 6:7))),
  # X_008 is size of town (8 bands), asked 2001-2024 only. Marco, 2026-09-30:
  # three groups instead of urban/rural, which LB does not record.
  list(id = "town", label = "Town size", source = "X_008", from = 2001,
       groups = list(list(id = "town_cap",   label = "Capital city",         codes = 8),
                     list(id = "town_big",   label = "Other city 100,000+",  codes = 7),
                     list(id = "town_small", label = "Town under 100,000",   codes = 1:6)))
)
SUBGROUP_NOTES <- list(
  edu  = "Education from S_101 (7 codes): 1–3 primary or less, 4–5 secondary or technical, 6–7 higher. In 2016 the merge's recode of S_101 differs from the wave file for about 4% of respondents.",
  town = "Town size from X_008, asked 2001–2024 only (and not in one country in 2020). Capital city = code 8; other city of 100,000+ = code 7; towns under 100,000 = codes 1–6."
)

MIN_CELL_N <- 30   # cells with fewer valid respondents are written but flagged; the UI hides them

# ---- Fixed country sets for regional averages ----------------------------------
# Regional values are the unweighted mean of country estimates (each country
# counts equally) and are only shown for years in which EVERY member has data,
# as lb_region() does. The first three are LB_functions.R's sets; the three
# subregions (Marco, 2026-09-30) are balanced over 1996-2024 (Southern Cone: 1995-2024).
COUNTRY_SETS <- list(
  list(id = "bal16", label = "16 countries (all but Dominican Rep. and Nicaragua)", short = "16-country average",
       lb = "LB_SET_BAL16", span = "1996–2024", balanced = TRUE,
       countries = c("AR", "BO", "BR", "CL", "CO", "CR", "EC", "SV", "GT", "HN", "MX", "PA", "PY", "PE", "UY", "VE")),
  list(id = "bal17", label = "17 countries (all but Nicaragua), from 2004", short = "17-country average",
       lb = "LB_SET_BAL17_04", span = "2004–2024", balanced = TRUE,
       countries = c("AR", "BO", "BR", "CL", "CO", "CR", "DO", "EC", "SV", "GT", "HN", "MX", "PA", "PY", "PE", "UY", "VE")),
  list(id = "set1995", label = "8 countries surveyed in 1995", short = "8-country average",
       lb = "LB_SET_1995", span = "1995–2024", balanced = TRUE,
       countries = c("AR", "BR", "CL", "MX", "PY", "PE", "UY", "VE")),
  list(id = "mxca", label = "Mexico & Central America (6)", short = "Mexico & Central America",
       span = "1996–2024", balanced = TRUE, note = "Nicaragua (not surveyed 2023–24) and the Dominican Republic (from 2004) are left out so the set is balanced.",
       countries = c("MX", "GT", "SV", "HN", "CR", "PA")),
  list(id = "andes", label = "Andean countries (5)", short = "Andean average",
       span = "1996–2024", balanced = TRUE,
       countries = c("BO", "CO", "EC", "PE", "VE")),
  list(id = "scone", label = "Southern Cone + Brazil (5)", short = "Southern Cone + Brazil",
       span = "1995–2024", balanced = TRUE,
       countries = c("AR", "BR", "CL", "PY", "UY")),
  # Costa Rica and Panama have no armed forces; in most years confidence in the armed forces
  # (H_002_161) was not asked there, so a balanced line over 16 countries exists in only 4 years.
  list(id = "bal14af", label = "14 countries with armed forces (the 16 minus Costa Rica, Panama)", short = "14-country average",
       span = "1996–2024", balanced = TRUE, note = "For confidence in the armed forces (H_002_161): Costa Rica and Panama have no army, and in most years the question was not asked there.",
       countries = c("AR", "BO", "BR", "CL", "CO", "EC", "SV", "GT", "HN", "MX", "PY", "PE", "UY", "VE")),
  list(id = "all18", label = "All countries surveyed that year (unbalanced)", short = "All surveyed (unbalanced)",
       lb = "LB_SET_ALL18", span = "1995–2024", balanced = FALSE,
       note = "Membership changes over time (8 countries in 1995, Dominican Republic from 2004, no Nicaragua 2023–24), which can move the line by itself. The number of countries is shown for every point.",
       countries = c("AR", "BO", "BR", "CL", "CO", "CR", "DO", "EC", "SV", "GT", "HN", "MX", "NI", "PA", "PY", "PE", "UY", "VE"))
)
DEFAULT_SET <- "bal16"

# ---- Continuous variables: histogram bins -------------------------------------
N_BINS <- 10
