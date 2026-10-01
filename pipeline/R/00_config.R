# =============================================================================
# 00_config.R: everything survey-specific lives here (plus pipeline/config/*.csv)
#
# To adapt this pipeline to another barometer (e.g. Latinobarómetro), replace
# this file and the CSVs in pipeline/config/. The estimation code in 10–50_*.R
# is survey-agnostic.
# =============================================================================

SURVEY <- list(
  id          = "abs",
  name        = "Asian Barometer Survey",
  short       = "ABS",
  region      = "Asia and the Pacific",
  url         = "https://www.asianbarometer.org",
  attribution = paste(
    "The Asian Barometer Survey is based at the Hu Fu Center for East Asia Democratic Studies,",
    "National Taiwan University, and co-organized with the Institute of Political Science, Academia Sinica."),
  citation    = "Asian Barometer Survey, Waves 1–6. Data available at www.asianbarometer.org.",
  unit_label  = "Wave",              # LB would use "Year"
  contact     = "widodomarco@gmail.com"
)

# ---- Paths -------------------------------------------------------------------
# ABS_DATA_DIR: the "Asian Barometer Data" folder (Wave1.sav … Wave6.sav,
# HarmonizedMerge_v1.sav, Data Cleaning/ABS_Variable_Harmonization_Crosswalk.xlsx).
# Set it with Sys.setenv(ABS_DATA_DIR = "...") before knitting, or edit the default.
DATA_DIR <- Sys.getenv("ABS_DATA_DIR",
  unset = "~/Desktop/Larry RA/Asian Barometer Data")
CROSSWALK <- file.path(DATA_DIR, "Data Cleaning", "ABS_Variable_Harmonization_Crosswalk.xlsx")
HARMONIZED <- file.path(DATA_DIR, "HarmonizedMerge_v1.sav")
wave_file <- function(w) file.path(DATA_DIR, sprintf("Wave%d.sav", w))

CONFIG_DIR <- file.path(PIPELINE_DIR, "config")
OUT_DIR    <- file.path(PIPELINE_DIR, "..", "public", "data")   # site data
REVIEW_DIR <- file.path(PIPELINE_DIR, "output")                 # review tables

# ---- Waves -------------------------------------------------------------------
WAVES <- tibble::tribble(
  ~wave, ~label,   ~years,     ~weight_var, ~country_var,
  1L,    "Wave 1", "2001–03",  "w_all",     "country",
  2L,    "Wave 2", "2005–08",  "w_all",     "country",
  3L,    "Wave 3", "2010–12",  "allweight", "country",
  4L,    "Wave 4", "2014–16",  "w",         "country",
  5L,    "Wave 5", "2018–21",  "w",         "country",
  6L,    "Wave 6", "2021–23",  "w",         "country"
)

# ---- Variables that are never shown (identifiers, weights, dates) --------------
# Matched against lower-cased variable names.
ADMIN_VARS_RX <- paste0(
  "^(country|idnumber|year|month|yrsurvey|w|w_[a-z]+|allweight|couweight|",
  "ir0|ir1|ir001|ir007_[123]|ir9|ir9_[123])$")

# ---- Subgroups (computed from HarmonizedMerge_v1 so they are identical in every view)
# Each dimension: an id, a label, and groups defined on a harmonized column.
SUBGROUPS <- list(
  list(id = "gender", label = "Gender", source = "se_gender",
       groups = list(list(id = "men",   label = "Men",   codes = 1),
                     list(id = "women", label = "Women", codes = 2))),
  list(id = "age", label = "Age", source = "se_age",
       groups = list(list(id = "age18", label = "Under 30", range = c(0, 29)),
                     list(id = "age30", label = "30–44",    range = c(30, 44)),
                     list(id = "age45", label = "45–59",    range = c(45, 59)),
                     list(id = "age60", label = "60+",      range = c(60, 120)))),
  list(id = "edu", label = "Education", source = "se_education",
       groups = list(list(id = "edu_low",  label = "Primary or less",       codes = 1:3),
                     list(id = "edu_mid",  label = "Secondary",             codes = 4:7),
                     list(id = "edu_high", label = "Some university or more", codes = 8:9))),
  list(id = "urban", label = "Urban / rural", source = "urban",   # built from level/level3
       groups = list(list(id = "urban", label = "Urban", codes = 1),
                     list(id = "rural", label = "Rural", codes = 2)))
)
# Urban/rural is not in the crosswalk. It is read from the raw files by label,
# because W1–W3 (level3) code 1 = urban, 2 = rural, while W4–W6 (level) code
# 1 = rural, 2 = urban. "No registration" (W1–W2 China) → NA.
URBAN_SOURCE <- c(`1` = "level3", `2` = "level3", `3` = "level3",
                  `4` = "level",  `5` = "level",  `6` = "level")

MIN_CELL_N <- 30   # cells with fewer valid respondents are written but flagged; the UI hides them

# ---- Fixed country sets for regional averages ----------------------------------
# Regional values are the unweighted mean of country estimates (each country
# counts equally) and are only shown for waves in which EVERY member has data.
COUNTRY_SETS <- list(
  list(id = "core5",  label = "Core 5 (surveyed in all six waves)",
       countries = c("JP", "KR", "MN", "PH", "TW")),
  list(id = "w2to6",  label = "9 countries surveyed in Waves 2–6",
       countries = c("JP", "KR", "MN", "PH", "TW", "ID", "SG", "VN", "MY")),
  list(id = "w1to5",  label = "8 countries surveyed in Waves 1–5",
       countries = c("JP", "HK", "KR", "CN", "MN", "PH", "TW", "TH")),
  list(id = "east",   label = "East Asia",
       countries = c("JP", "KR", "TW", "HK", "CN", "MN")),
  list(id = "southeast", label = "Southeast Asia",
       countries = c("PH", "TH", "ID", "SG", "VN", "KH", "MY", "MM"))
)
DEFAULT_SET <- "core5"

# ---- Continuous variables: histogram bins -------------------------------------
N_BINS <- 10
