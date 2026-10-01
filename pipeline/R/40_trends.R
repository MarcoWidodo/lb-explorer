# =============================================================================
# 40_trends.R: harmonized time series from HarmonizedMerge_v1 + the crosswalk
#
# HarmonizedMerge_v1.sav already holds every harmonized item on its crosswalk
# scale with all non-substantive codes set to NA. To also offer the "asked"
# denominator, each NA is traced back to its raw source code in Wave<w>.sav
# (rows are in the same order, checked in the build): a raw don't know /
# can't choose / decline / do not understand is a nonresponse; anything else
# (missing, not applicable, not fielded, or a substantive raw code the
# crosswalk sets to missing, e.g. "both equally important") is left out of
# both denominators.
# =============================================================================

read_crosswalk <- function(path = CROSSWALK) {
  xw <- read_excel(path, sheet = "Variable Crosswalk")
  names(xw)[1:3] <- c("id", "category", "question")
  wcols <- grep("^W[1-6] Variable", names(xw))
  xw <- xw |> filter(!is.na(id)) |>
    rename(scale = `Harmonized Scale`, points = `Scale Points`,
           ts = `Include in\nTime Series?`, notes = `Notes / Warnings`)
  rules <- read_excel(path, sheet = "Recode Rules") |>
    mutate(wave = as.integer(wave), source_variable = tolower(source_variable))
  list(xw = xw, rules = rules)
}

# "1=Very bad, 2=Bad, …" → codes/labels. 10-point scales only label the ends
# ("1=Completely undemocratic → 10=Completely democratic"); middle codes get digits.
parse_scale_labels <- function(s, points) {
  m <- regmatches(s, gregexpr("(\\d+)=([^,;→]+)", s))[[1]]
  codes <- as.numeric(sub("=.*$", "", m)); labs <- trimws(sub("^\\d+=", "", m))
  labs <- sub("\\s*\\(W\\d\\)$", "", labs)
  keep <- !duplicated(codes); codes <- codes[keep]; labs <- labs[keep]
  out <- as.character(seq_len(points))
  out[codes[codes <= points]] <- labs[codes <= points]
  out
}

# Default summary for each harmonized item: a mean for 7+ point scales, otherwise the
# share in the top category/categories (rule 7 of the project's trend instructions).
# config/trend_indicators.csv overrides the codes, and marks unordered items (no mean).
default_indicator <- function(id, points, labels, overrides) {
  ov <- overrides[overrides$harmonized_id == id, ]
  mean_ok <- !(nrow(ov) && toupper(ov$allow_mean) == "FALSE")
  if (nrow(ov)) {
    codes <- as.integer(strsplit(ov$success_codes, ";")[[1]])
  } else if (points >= 7) {
    return(list(type = "mean", label = sprintf("Mean (1–%d)", points), mean_ok = TRUE))
  } else {
    codes <- switch(as.character(points), `2` = 2L, `3` = 3L, `6` = 4:6, c(points - 1L, points))
  }
  list(type = "share", codes = arr(codes), mean_ok = mean_ok,
       label = paste0("% ", paste(labels[codes], collapse = " + ")))
}

# Fieldwork year per country × wave: median interview year (HarmonizedMerge
# `year`), with the 5th–95th percentile span; documented fallbacks where the
# file has no year.
fieldwork_years <- function(hm, fallbacks, iso_of) {
  fy <- hm |> filter(!is.na(year)) |>
    group_by(wave, country) |>
    summarise(year = as.integer(round(median(year))), y_lo = as.integer(quantile(year, 0.05, type = 1)),
              y_hi = as.integer(quantile(year, 0.95, type = 1)), .groups = "drop") |>
    mutate(iso2 = iso_of[as.character(country)], source = "data")
  have <- paste(fy$wave, fy$iso2)
  fb <- fallbacks |> filter(!paste(wave, iso2) %in% have) |>
    transmute(wave = as.integer(wave), iso2, year = as.integer(year), y_lo = year, y_hi = year, source)
  bind_rows(fy |> select(-country), fb)
}
