# =============================================================================
# 40_indicators.R: default summaries, trend breaks and question metadata
#
# Latinobarómetro variables are already harmonised across years (one variable,
# one scale), so there is no crosswalk recoding step: the trend for a question
# is its year-by-year estimates. This file decides how each question is
# summarised by default and where a trend must not be bridged.
# =============================================================================

# Default indicator (instructions §5 and rule 7):
#   config/trend_indicators.csv     -> as listed (the core democracy and trust series)
#   continuous, or ordinal 7+ codes -> mean (interval-like: 0–10, 1–10)
#   ordinal 4–6 codes               -> % in the top two categories (codes 1–2: LB scales run from the positive end)
#   ordinal 3 codes                 -> % in the first category
#   binary                          -> % "yes": code 1 (also for 0/1 "mentioned" items)
#   nominal                         -> the most common answer in the latest year (set in the build)
default_indicator <- function(v, type, scale_codes, ti) {
  row <- ti[ti$variable == v, ]
  if (nrow(row)) {
    if (row$success_codes == "mean") return(list(type = "mean"))
    return(list(type = "share", codes = arr(as.numeric(strsplit(row$success_codes, ";")[[1]]))))
  }
  sc <- scale_codes
  if (type == "continuous" || (type == "ordinal" && length(sc) >= 7)) return(list(type = "mean"))
  if (type == "ordinal") return(list(type = "share", codes = arr(if (length(sc) >= 4) sc[1:2] else sc[1])))
  if (type == "binary") return(list(type = "share", codes = arr(if (all(sc %in% c(0, 1))) 1 else sc[1])))
  NULL
}

mean_allowed <- function(type, scale_codes) type == "continuous" || (type == "ordinal" && length(scale_codes) >= 7)

# Years that a trend must not bridge (config/trend_breaks.csv). "all" = no trend at all.
trend_breaks <- function(v, tb) {
  row <- tb[tb$variable == v, ]
  if (!nrow(row)) return(NULL)
  yrs <- if (row$years == "all") "all" else arr(as.integer(strsplit(row$years, ";")[[1]]))
  list(years = yrs, note = row$note)
}

# Crosswalk: Spanish title and the original question number in each year's questionnaire.
read_lb_crosswalk <- function(path = CROSSWALK) {
  xw <- readxl::read_excel(path)
  ycols <- grep("^LAT\\d{4}$", names(xw), value = TRUE)
  xw <- xw[!is.na(xw$Variable), ]
  list(
    title_es = setNames(as.character(xw[[2]]), xw$Variable),        # column 2 = "Título" (Spanish title)
    qn = lapply(setNames(seq_len(nrow(xw)), xw$Variable), function(i) {
      q <- unlist(xw[i, ycols]); names(q) <- sub("^LAT", "", ycols)
      q <- q[!is.na(q) & nzchar(q)]
      if (length(q)) as.list(q) else NULL
    })
  )
}
