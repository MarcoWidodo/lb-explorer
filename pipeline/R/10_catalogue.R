# =============================================================================
# 10_catalogue.R: classify response codes and variables (Latinobarómetro rules)
#
# Two decisions drive every number on the site, so they are made here, once,
# and written to output/catalogue_review.csv for review:
#
#   1. Each response code is "substantive", "offscale" (a valid answer that is
#      not on the scale), "nonresponse" or "not_asked".
#        - NEGATIVE codes are classified BY CODE, exactly as lb_cy_share() does:
#            -1, -2, -5  -> nonresponse (the merge mixes up -1 and -2, so they
#                           are collapsed into one "Don't know / no answer")
#            any other   -> not_asked (-3 not applicable, -4 not asked,
#                           -6/-8 "none", -7, -999): out of both bases
#        - POSITIVE codes are classified BY LABEL, as in the ABS engine, with
#          English and Spanish patterns. A positive code reclassified as
#          nonresponse is listed in catalogue_review.csv, because
#          lb_cy_share() would count it as valid.
#   2. Each variable is "ordinal", "binary", "continuous", "nominal", "admin"
#      or "text". Correlations use ordinal, binary and continuous items; means
#      are offered only for interval-like scales (7+ points, e.g. 0–10, 1–10)
#      and numeric items (instructions rule 7).
#
# Manual corrections go in config/variable_overrides.csv (variable, type, note).
# =============================================================================

norm_label <- function(s) {
  s <- tolower(trimws(as.character(s)))
  s <- gsub("[‘’`´]", "'", s, perl = TRUE)
  gsub("\\s+", " ", s, perl = TRUE)
}

NR_CODES <- c(-1, -2, -5)          # lb_cy_share(base = "asked") adds exactly these
NR_LABEL <- "Don't know / no answer"

# Positive codes that are non-answers. Most DK-type positive codes were already
# moved to -1 by the cleaning (LB_DK_LABEL_PATTERN); these are the ones it left.
NONRESPONSE_RX <- c(
  "^no responde$", "^no sabe$", "^ns/nr$", "^no contesta$", "^voto secreto$",
  "^no answer( or refused)?$", "^refused$",
  "^i don't remember( what i did)?$", "^(don't|can't) remember$",
  "^unknown$"                       # K_007_311 code 96: leader not known (as LB's 96 "does not know the person")
)
NOT_ASKED_RX <- c("^not asked", "^no preguntada", "^not applicable", "^no aplica")
# Valid answers off the response scale: shown in distributions, left out of means.
OFFSCALE_RX <- c(
  "doesn't have (a job|these services|the service|insurance)", "doesn't have enough information",
  "i don't understand what a democracy is", "depends", "^both", "^neither$", "^none of (them|the above|these)",
  "^others?\\b", "^otros?\\b", "not sure", "no opinion", "indifferent", "i don't have access",
  "^i am not \\("                  # B_011_011 5 "I am not (nationality)": a valid answer off the pride scale
)

classify_label <- function(labels) {
  l <- norm_label(labels)
  hit <- function(rx) Reduce(`|`, lapply(rx, grepl, x = l, perl = TRUE), FALSE)
  ifelse(hit(NOT_ASKED_RX), "not_asked", ifelse(hit(NONRESPONSE_RX), "nonresponse",
         ifelse(hit(OFFSCALE_RX), "offscale", "substantive")))
}

classify_codes <- function(codes, labels) {
  ifelse(codes < 0, ifelse(codes %in% NR_CODES, "nonresponse", "not_asked"),
         ifelse(is.na(labels), "substantive", classify_label(labels)))
}

# Words that make a set of value labels look like an ordered scale (English + Spanish).
SCALE_WORDS_RX <- paste0(
  "agree|disagree|left|right|trust|confiden|satisf|good|bad|better|worse|same|often|never|always|sometimes|",
  "rarely|frequent|occasional|likely|probabl|important|interest|close|proud|willing|influence|",
  "free|fair|easy|difficult|safe|unsafe|strong|weak|much|little|a lot|very|somewhat|rather|fairly|",
  "not at all|none|hardly|everyone|most|some|few|capable|responsive|corrupt|democra|",
  "worried|concern|serious|manage|approve|positive|negative|\\byes\\b|\\bno\\b|more|less|",
  "increase|decrease|once|twice|times|every|daily|day|week|month|year|high|low|status|",
  "poor|rich|lowest|highest|completely|fully|partly|support|oppose|favo|prefer|matter|",
  "justif|possible|sure|definitely|enough|sufficient|insufficient|protected|guaranteed|",
  "informed|beneficial|practi|improv|stayed|remained|increased|decreased|have done|could do|would (never )?do|",
  "mucho|poco|nada|algo|bueno|malo|mejor|peor|acuerdo|desacuerdo|satisfecho|confianza|",
  "illiterate|primary|secondary|high|university|educat|complete|incomplete|",
  "^(none|one|two|three|four|five|six|seven)$|^\\d+ days?$|",
  "^\\d+$|^\\d+\\.\\s|^\\d+ ?[-–] ?\\w+|\\w+ ?[-–] ?\\d+$")

# Question labels that mark an unordered list of answers. Kept specific: broad words such as
# "region", "religion" or "sector" also occur in ordered items ("Freedom of religion/faith",
# "regional integration", "leave productive activity to the private sector").
NOMINAL_LABEL_RX <- paste0(
  "most important problem|vote for|would vote|vote this sunday|voted political party|political party voted|",
  "which (party|parties|country|one|of the following)|^religi[oó]n$|mother tongue|\\blanguage\\b|ethnicity or race|",
  "who (has|holds) (the )?most power|kind of work|occupational status|employment situation|type of employment|",
  "civil status|marital|best friend country|country do you admire|more leadership|trading partner|protectionist|",
  "where do you|first mention|second mention|third mention|reasons why|meaning of democracy|immigrate|",
  "most important (characteristic|thing|issue|factors|environment)|multilateral institution|most frequent use|",
  "internet access|most discriminated")

NEUTRAL_LABEL_RX <- "^[\\s.…\\d]*(st|nd|rd|th)?$"   # "...", "2", "3": middle points of 0-10 scales

var_type_one <- function(name, label, xv, ct) {
  if (name %in% ADMIN_VARS) return(list(type = "admin", reason = "identifier/weight/design"))
  scale <- ct[ct$class == "substantive", ]
  obs <- sort(unique(xv[!is.na(xv) & xv %in% scale$code]))
  if (!length(obs)) return(list(type = "empty", reason = "no substantive values"))
  numeric_label <- !is.na(scale$label) &
    (scale$label == format(scale$code, trim = TRUE) |
     startsWith(trimws(scale$label), paste0(format(scale$code, trim = TRUE), " ")) |
     grepl("^\\d+(\\.\\d+)?$", trimws(scale$label)))
  labelled <- scale[!is.na(scale$label) & !numeric_label, ]
  if (nrow(labelled) <= 2 && (length(obs) > 12 || (nrow(labelled) == 0 && length(obs) >= 5)))
    return(list(type = "continuous", reason = sprintf("%d distinct values, %d text labels", length(obs), nrow(labelled))))
  codes <- sort(unique(scale$code[scale$code %in% obs]))
  if (length(codes) == 2) return(list(type = "binary", reason = "two scale codes"))
  if (length(codes) == 1) return(list(type = "nominal", reason = "one scale code"))
  nominal_label <- grepl(NOMINAL_LABEL_RX, norm_label(label), perl = TRUE)
  # an off-scale answer inside the range ("It depends on the circumstances" as code 3 of 1-5) does not break the scale
  off_in <- ct$code[ct$class == "offscale" & ct$observed & ct$code > min(codes) & ct$code < max(codes)]
  consecutive <- all(diff(sort(c(codes, off_in))) == 1)
  labs <- norm_label(scale$label[!is.na(scale$label) & scale$code %in% codes])
  labs <- labs[!grepl(NEUTRAL_LABEL_RX, labs, perl = TRUE)]
  scale_share <- if (length(labs)) mean(grepl(SCALE_WORDS_RX, labs, perl = TRUE)) else 1
  if (length(codes) >= 3 && length(codes) <= 12 && consecutive && !nominal_label && scale_share >= 0.5)
    return(list(type = "ordinal", reason = sprintf("%d consecutive codes, %.0f%% scale-like labels", length(codes), 100 * scale_share)))
  # 0-10 / 1-10 scales labelled only at the ends ("Left" 1 2 ... 9 "Right")
  mid <- scale$label[scale$code %in% codes[-c(1, length(codes))]]
  if (length(codes) >= 7 && length(codes) <= 12 && consecutive && !nominal_label &&
      all(is.na(mid) | grepl(NEUTRAL_LABEL_RX, norm_label(mid), perl = TRUE)))
    return(list(type = "ordinal", reason = sprintf("%d consecutive codes, labelled ends only", length(codes))))
  list(type = "nominal", reason = sprintf("%d codes, consecutive=%s, scale-like=%.0f%%, nominal label=%s",
                                          length(codes), consecutive, 100 * scale_share, nominal_label))
}

# Code table for one variable: every observed or labelled code, its label and class.
# Unlabelled observed codes: negative -> by code (as above); positive -> substantive,
# except a non-integer value on a labelled scale (a data-entry error) -> not_asked.
code_table <- function(labs, xv) {
  obs <- sort(unique(xv[!is.na(xv)]))
  lt <- if (is.null(labs) || is.character(labs)) tibble(code = numeric(), label = character()) else
    tibble(code = as.numeric(labs), label = names(labs)) |> distinct(code, .keep_all = TRUE)
  extra <- setdiff(obs, lt$code)
  if (length(extra)) lt <- bind_rows(lt, tibble(code = extra, label = NA_character_))
  lt <- lt |> arrange(code)
  lt$class <- classify_codes(lt$code, lt$label)
  n_text <- sum(lt$class == "substantive" & !is.na(lt$label))
  # An unlabelled 96-99 next to a fully labelled 0-10 / 1-10 rating scale is LB's "does not know
  # the person" convention (leader ratings, e.g. K_007_251 with 15,000 unlabelled 96s): nonresponse.
  # Only for rating scales: in lists, 96/97 are "Other"/"None" (religion, see config/code_labels.csv).
  lab_sub <- sort(lt$code[lt$class == "substantive" & !is.na(lt$label)])
  rating <- length(lab_sub) >= 7 && max(lab_sub) <= 10 && all(diff(lab_sub) == 1)
  if (rating) lt$class[is.na(lt$label) & lt$code %in% 96:99] <- "nonresponse"
  lt$class[is.na(lt$label) & lt$code >= 0 & lt$code != round(lt$code) & n_text >= 2] <- "not_asked"
  lt$observed <- lt$code %in% obs
  lt
}

section_of <- function(name) {
  s <- unname(LB_SECTIONS[substr(name, 1, 1)])
  if (is.na(s)) "Other questions" else s
}
