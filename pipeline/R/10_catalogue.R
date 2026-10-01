# =============================================================================
# 10_catalogue.R: classify response codes and variables
#
# Two decisions drive every number on the site, so they are made here, once,
# and written to output/catalogue_review.csv for review:
#
#   1. Each response code is "substantive", "nonresponse" (don't know, can't
#      choose, decline, do not understand) or "not_asked" (missing, not
#      applicable, skipped). Decided from the value label, never from the code,
#      because the same code means different things across waves and items
#      (e.g. W6 SE6 99 = "None", a valid answer; q141 97 = "Not the
#      government's responsibility").
#   2. Each variable is "ordinal", "binary", "continuous", "nominal", "admin"
#      or "text". Means, maps and correlations use only ordinal, binary and
#      continuous variables. Nominal items (party, religion, "which country…")
#      are shown as distributions only.
#
# Manual corrections go in config/variable_overrides.csv (wave, variable, type, note).
# =============================================================================

norm_label <- function(s) {
  s <- tolower(trimws(as.character(s)))
  s <- gsub("[‘’`]", "'", s, perl = TRUE)
  gsub("\\s+", " ", s, perl = TRUE)
}

NONRESPONSE_RX <- c(
  "^(\\d+\\.\\s*)?(do not|don't|dont'|don not|dont) under\\w*( the)?( questi\\w*)?,?$",
  "^(\\d+\\.\\s*)?don't understand/ ?don't know/ ?can't choose/ ?decline to answer.*$",
  "^(can't|cannot|can not|can't not) choose$", "^unclassifiable/can't choose$",
  "^(decline|deline) to (answer|answe|answear)$",
  "^(don't know|do not know|dont' know|don't know\\(can't choose\\))$",
  "^no answer( or can't understand)?$", "^refused$", "^refuse to answer$",
  "^don't respond$", "^(don't|can't) remember$", "^not stated / unknown$",
  "^can't determine$", "^no record$"
)
NOT_ASKED_RX <- c("^m(i)?s{1,2}ing$", "^not applicable", "^no more answer$", "^not asked")
# Substantive answers that sit off the response scale: shown in distributions,
# excluded from means, maps and correlations.
OFFSCALE_RX <- c("not sure", "not aware", "have not tried", "never tried", "not yet eligible",
  "not the government", "depends", "don't know much", "don't have any", "^others?\\b", "^both$",
  "none of these", "^single$", "no one i know", "haven't (heard|used)", "not heard of", "no opinion",
  "indifferent")

classify_codes <- function(labels) {
  l <- norm_label(labels)
  hit <- function(rx) Reduce(`|`, lapply(rx, grepl, x = l, perl = TRUE), FALSE)
  ifelse(hit(NOT_ASKED_RX), "not_asked", ifelse(hit(NONRESPONSE_RX), "nonresponse",
         ifelse(hit(OFFSCALE_RX), "offscale", "substantive")))
}

# Words that make a set of value labels look like an ordered scale.
SCALE_WORDS_RX <- paste0(
  "agree|disagree|trust|satisf|good|bad|better|worse|same|often|never|always|sometimes|",
  "rarely|frequent|occasional|likely|important|interest|close|proud|willing|influence|",
  "free|fair|easy|difficult|safe|unsafe|strong|weak|much|little|a lot|very|somewhat|",
  "not at all|none|hardly|everyone|most|some|few|capable|responsive|corrupt|democra|",
  "worried|serious|manage|approve|positive|negative|\\byes\\b|\\bno\\b|more|less|",
  "increase|decrease|once|twice|times|every|daily|week|month|year|high|low|status|",
  "poor|rich|lowest|highest|completely|fully|partly|support|oppose|favo|prefer|matter|",
  "religious|harm|help|benefit|confident|accept|justif|possible|probabl|sure|definitely|",
  "fine|minor|major|replace|changes?|necessar|essential|suitable|dissatisf|unfair|",
  "understand|equal|smaller|larger|bigger|primary|secondary|university|educat|",
  "generation|member|participat|active|voted|never done|done|already|ever|",
  "cooperat|sincere|impatien|refus|condition|all of|half|none of|quintile|hard|class|upper|lower|middle|",
  "^(none|one|two|three|four|five|six)$|",
  "^\\d+$|^\\d+ ?[-–] ?\\w+|\\w+ ?[-–] ?\\d+$")

NOMINAL_LABEL_RX <- paste0(
  "which (party|parties|candidate|organi[sz]ation|country|of the following|one|language)|",
  "vote for|name of the organi[sz]ation|organi[sz]ations? (that )?you belong|religion$|religion\\b(?!s? ?(ity|ous))|",
  "denomination|(racial|ethnic) (or ethnic )?background|ethnicity|ethnic group|language|dialect|isco|egp|",
  "job title|occupation|marital|^region$|province|what (are|is) the (\\w+ )?(most important|main) (problems?|questions|issues)|",
  "country of birth|nationality|sector|type of (work|job|employ)|kind of (work|job)|main source|",
  "who were they|closest to|feel close to\\?|social media platform|platform")

NEUTRAL_LABEL_RX <- "^[\\s.…\\d]*(st|nd|rd|th)?$"   # "...", "2", "3": middle points of 0-10 scales

var_type_one <- function(name, label, x, ct) {
  if (is.character(x)) return(list(type = "text", reason = "string"))
  if (grepl(ADMIN_VARS_RX, name)) return(list(type = "admin", reason = "identifier/weight/date"))
  xv <- as.numeric(zap_labels(x))
  scale <- ct[ct$class == "substantive", ]
  obs <- sort(unique(xv[!is.na(xv) & xv %in% scale$code]))
  if (!length(obs)) return(list(type = "empty", reason = "no substantive values"))
  # a label that just restates the number ("12", "12 years", "3 members") is not a text label
  numeric_label <- !is.na(scale$label) &
    (scale$label == format(scale$code, trim = TRUE) |
     startsWith(trimws(scale$label), paste0(format(scale$code, trim = TRUE), " ")))
  labelled <- scale[!is.na(scale$label) & !numeric_label, ]
  if (nrow(labelled) <= 2 && (length(obs) > 12 || (nrow(labelled) == 0 && length(obs) >= 5)))
    return(list(type = "continuous", reason = sprintf("%d distinct values, %d text labels", length(obs), nrow(labelled))))
  codes <- sort(unique(scale$code[scale$code %in% obs | !is.na(scale$label)]))
  if (length(codes) == 2) return(list(type = "binary", reason = "two scale codes"))
  nominal_label <- grepl(NOMINAL_LABEL_RX, norm_label(label), perl = TRUE)
  consecutive <- all(diff(codes) == 1)
  labs <- norm_label(scale$label[!is.na(scale$label)])
  labs <- labs[!grepl(NEUTRAL_LABEL_RX, labs, perl = TRUE)]
  scale_share <- if (length(labs)) mean(grepl(SCALE_WORDS_RX, labs, perl = TRUE)) else 1
  if (length(codes) >= 3 && length(codes) <= 12 && consecutive && !nominal_label && scale_share >= 0.5)
    return(list(type = "ordinal", reason = sprintf("%d consecutive codes, %.0f%% scale-like labels", length(codes), 100 * scale_share)))
  list(type = "nominal", reason = sprintf("%d codes, consecutive=%s, scale-like=%.0f%%, nominal label=%s",
                                          length(codes), consecutive, 100 * scale_share, nominal_label))
}

# Read a wave with user-defined missing values KEPT as their codes. Wave 1 declares
# 97/98/99 as SPSS user-missing on 199 variables; a default read_sav() turns them into
# NA, which would silently drop "don't know" / "no answer" from the asked base. Here they
# stay as codes and are classified by their labels like every other wave.
read_wave <- function(w) {
  d <- read_sav(wave_file(w), user_na = TRUE)
  names(d) <- tolower(names(d))
  for (v in names(d)) {
    x <- d[[v]]
    if (inherits(x, "haven_labelled_spss")) {
      attr(x, "na_values") <- NULL; attr(x, "na_range") <- NULL
      class(x) <- setdiff(class(x), "haven_labelled_spss")
      d[[v]] <- x
    }
  }
  d
}

section_of <- function(name, w, sections) {
  if (grepl("^q\\d", name)) {
    qn <- as.numeric(sub("^q(\\d+).*$", "\\1", name))
    s <- sections[sections$wave == w & sections$q_from <= qn, ]
    if (nrow(s)) return(s$section[which.max(s$q_from)])
    return("Other questions")
  }
  if (grepl("^(se\\d|relig|fgnum|pgnum|actual_count)", name)) return("Socio-economic Background")
  if (grepl("^(ir|malaysia_ir)", name)) return("Interview Record")
  if (grepl("^(level|level3|region)$", name)) return("Sample Design")
  if (grepl("^japan_q(\\d+)", name)) return(section_of(sub("^japan_", "", name), w, sections))
  "Other questions"
}

# Build the catalogue for one wave: one row per variable with its type, section,
# codes (substantive / nonresponse / not_asked) and labels.
build_catalogue <- function(w, d, sections, overrides) {
  rows <- lapply(names(d), function(v) {
    x <- d[[v]]
    lab <- attr(x, "label") %||% v
    t <- if (is.character(x)) list(type = "text", reason = "string") else var_type_one(v, lab, x, code_table(x))
    ov <- overrides[overrides$wave == w & overrides$variable == v, ]
    if (nrow(ov)) t <- list(type = ov$type[1], reason = paste("override:", ov$note[1]))
    tibble(wave = w, variable = v, label = clean_question(lab, v), raw_label = lab,
           type = t$type, reason = t$reason, section = section_of(v, w, sections))
  })
  bind_rows(rows)
}

# Strip the leading question number/name from labels ("1. How would…", "q1 How…",
# "se6 Religion", "IR2. Is this…") so the UI can show "Q1" separately.
clean_question <- function(lab, v) {
  s <- trimws(gsub("\\s+", " ", lab))
  s <- sub(paste0("^", v, "[\\.:]?\\s+"), "", s, ignore.case = TRUE)
  s <- sub("^(q|se|ir)?\\s?\\d+[a-z]?(_\\d+)?[\\.:)]?\\s+(?=[A-Za-z(\\[])", "", s, ignore.case = TRUE, perl = TRUE)
  s <- sub("^[A-Z]\\.\\s+", "", s)
  s <- sub("^\\t+", "", s)
  if (nchar(s) == 0) lab else s
}

# Code table for one variable: which codes are substantive / nonresponse / not_asked,
# and the label of each. Unlabelled observed codes are substantive if >= 0,
# not_asked if negative.
code_table <- function(x) {
  labs <- attr(x, "labels")
  xv <- as.numeric(zap_labels(x))
  obs <- sort(unique(xv[!is.na(xv)]))
  lt <- if (is.null(labs) || is.character(labs)) tibble(code = numeric(), label = character()) else
    tibble(code = as.numeric(labs), label = names(labs)) |> distinct(code, .keep_all = TRUE)
  lt$class <- if (nrow(lt)) classify_codes(lt$label) else character()
  extra <- setdiff(obs, lt$code)
  # Unlabelled values: negative = not asked. On a labelled scale, a non-integer value
  # (e.g. one "2.5" on a 1-10 scale in W6 q92) is a data-entry error and is dropped,
  # as in HarmonizedMerge_v1.
  n_lab_sub <- sum(lt$class == "substantive")
  # text labels (not "12" or "12 years"): a scale such as "1 = Completely undemocratic … 10"
  sub_lt <- lt[lt$class == "substantive" & !is.na(lt$label), ]
  n_text <- sum(sub_lt$label != format(sub_lt$code, trim = TRUE) &
                !startsWith(trimws(sub_lt$label), paste0(format(sub_lt$code, trim = TRUE), " ")))
  if (length(extra)) lt <- bind_rows(lt, tibble(code = extra, label = NA_character_,
    class = ifelse(extra < 0, "not_asked", ifelse(n_text >= 2 & extra != round(extra), "not_asked",
            # an unlabelled 97/98/99 next to a small labelled scale is the ABS don't-understand /
            # can't-choose / decline convention (e.g. W2 se9 China 97)
            ifelse(n_lab_sub >= 2 & extra %in% c(97, 98, 99, 997, 998, 999, 9997, 9998, 9999) &
                   all(lt$code[lt$class == "substantive"] < 90), "nonresponse", "substantive")))))
  lt <- lt |> arrange(code)
  # Country-specific variants stored far above the main scale (e.g. W6 AU income
  # 1501-1505 next to quintiles 1-5; W6 q33 proxy codes 1103/1104) are off-scale.
  sc <- lt$code[lt$class == "substantive"]
  if (length(sc) >= 2) {
    run_max <- sc[which.min(c(diff(sc) == 1, FALSE))]
    far <- lt$class == "substantive" & lt$code >= 100 & lt$code > 10 * max(run_max, 1)
    if (run_max <= 12 && sum(far) <= 10) lt$class[far] <- "offscale"
  }
  lt
}
