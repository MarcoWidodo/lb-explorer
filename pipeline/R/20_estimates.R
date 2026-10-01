# =============================================================================
# 20_estimates.R: weighted country × subgroup estimates for one variable
#
# Definitions (identical for single-wave items and harmonized trends):
#   asked  = respondents with a substantive or a nonresponse code
#            (don't know / can't choose / decline / do not understand)
#   valid  = respondents with a substantive code
#   p[k]   = weighted % of VALID respondents giving code k        (valid base)
#   q[j]   = weighted % of ASKED respondents giving nonresponse j  (asked base)
#            → asked-base % for a substantive code = p[k] × (1 − Σq / 100)
#   c[k]   = unweighted count giving code k
#   m, sd  = weighted mean and SD over valid respondents (ordinal/binary/continuous only)
#   ne     = Kish effective sample size (Σw)² / Σw² over valid respondents
#   se     = sd / sqrt(ne)   (no design information beyond the weights is available)
# Weights are the within-country weights, normalised to mean 1 in each country.
# =============================================================================

GROUP_IDS <- c("all", unlist(lapply(SUBGROUPS, function(s) vapply(s$groups, `[[`, "", "id"))))

# Long table of (row, group) memberships. Every row is in "all" plus at most one
# group per subgroup dimension.
build_memberships <- function(demo) {
  out <- list(data.table(row = seq_len(nrow(demo)), grp = "all"))
  for (s in SUBGROUPS) {
    v <- demo[[s$source]]
    for (g in s$groups) {
      hit <- if (!is.null(g$codes)) v %in% g$codes else !is.na(v) & v >= g$range[1] & v <= g$range[2]
      out[[length(out) + 1]] <- data.table(row = which(hit), grp = g$id)
    }
  }
  m <- rbindlist(out)
  m[, grp := factor(grp, levels = GROUP_IDS)]
  m
}

# Continuous variables: `N_BINS` equal-width bins with pretty breaks over the
# 1st–99th percentile of pooled valid values; the end bins are open.
make_bins <- function(v) {
  v <- v[!is.na(v)]
  q <- quantile(v, c(0.01, 0.99), names = FALSE)
  if (q[1] == q[2]) q <- range(v)
  br <- pretty(q, n = N_BINS)
  br <- br[br > min(v) & br <= max(v)]
  if (!length(br)) br <- median(v)
  fmt <- function(z) format(z, big.mark = ",", scientific = FALSE, trim = TRUE)
  lo <- c(-Inf, br); hi <- c(br, Inf)
  lab <- ifelse(is.infinite(lo), paste0("Under ", fmt(hi)),
         ifelse(is.infinite(hi), paste0(fmt(lo), " or more"),
                paste0(fmt(lo), "–", fmt(hi - ifelse(all(v == round(v)), 1, 0)))))
  list(breaks = br, labels = lab)
}
bin_index <- function(v, bins) findInterval(v, bins$breaks) + 1L

r1 <- function(x) round(x, 1)

# x      numeric codes for every respondent in the wave
# cls    "substantive" (on the response scale) / "offscale" (valid answer off the
#        scale, e.g. "have not tried") / "nonresponse" / "not_asked" for each respondent.
#        Distributions use substantive + offscale; means use substantive only.
# codes  substantive codes in display order; nr_codes nonresponse codes
# xbin   for continuous variables, the bin index (display codes = 1..B)
estimate_cells <- function(x, cls, codes, nr_codes, cty, wt, memb, with_mean, xbin = NULL,
                           sparse = FALSE) {
  disp <- if (is.null(xbin)) x else xbin
  dt <- memb[, .(row, grp)]
  dt[, `:=`(cty = cty[row], w = wt[row], x = x[row], d = disp[row], cl = cls[row])]
  dt <- dt[cl %in% c("substantive", "offscale", "nonresponse")]
  if (!nrow(dt)) return(list())
  tot <- dt[, .(n = .N, sw_asked = sum(w)), by = .(cty, grp)]
  val <- dt[cl %in% c("substantive", "offscale"), .(nv = .N, sw = sum(w), sw2 = sum(w^2)), by = .(cty, grp)]
  mn <- dt[cl == "substantive", .(nm = .N, m = sum(w * x) / sum(w), ss = sum(w * x^2) / sum(w),
                                   swm = sum(w), sw2m = sum(w^2)), by = .(cty, grp)]
  val <- merge(val, mn, by = c("cty", "grp"), all.x = TRUE)
  sub_k <- dt[cl %in% c("substantive", "offscale"), .(sw = sum(w), n = .N), by = .(cty, grp, d)]
  nr_k  <- dt[cl == "nonresponse", .(sw = sum(w)), by = .(cty, grp, x)]
  cells <- merge(tot, val, by = c("cty", "grp"), all.x = TRUE)
  cells[is.na(nv), `:=`(nv = 0L, sw = 0, sw2 = 0)]
  setorder(cells, cty, grp)
  key <- paste(cells$cty, cells$grp)
  nc <- nrow(cells)
  # substantive distribution: dense matrix (cells × codes) unless sparse
  if (!sparse) {
    P <- matrix(0, nc, length(codes)); C <- matrix(0L, nc, length(codes))
    ri <- match(paste(sub_k$cty, sub_k$grp), key); ci <- match(sub_k$d, codes)
    stopifnot(!anyNA(ci))                     # every substantive value has a display code
    P[cbind(ri, ci)] <- sub_k$sw; C[cbind(ri, ci)] <- sub_k$n
    P <- round(100 * P / pmax(cells$sw, 1e-12), 1)
  } else {
    sk_list <- split(sub_k[order(d)], by = c("cty", "grp"), sorted = FALSE, drop = TRUE, keep.by = FALSE)
    names(sk_list) <- sub(".", " ", names(sk_list), fixed = TRUE)
  }
  if (length(nr_codes)) {
    Q <- matrix(0, nc, length(nr_codes))
    if (nrow(nr_k)) {
      ri <- match(paste(nr_k$cty, nr_k$grp), key); ci <- match(nr_k$x, nr_codes)
      Q[cbind(ri, ci)] <- nr_k$sw
    }
    Q <- round(100 * Q / cells$sw_asked, 1)
  }
  ne_exact <- cells$sw^2 / cells$sw2
  ne <- round(ne_exact, 1)
  sdv <- sqrt(pmax(cells$ss - cells$m^2, 0))
  ne_mean <- cells$swm^2 / cells$sw2m
  out <- vector("list", nc)
  for (i in seq_len(nc)) {
    cell <- list(n = cells$n[i], nv = cells$nv[i])
    if (cells$nv[i] > 0) {
      cell$ne <- ne[i]
      if (sparse) {
        sk <- sk_list[[key[i]]]
        cell$k <- arr(sk$d); cell$p <- arr(r1(100 * sk$sw / cells$sw[i])); cell$c <- arr(sk$n)
      } else {
        cell$p <- arr(P[i, ]); cell$c <- arr(C[i, ])
      }
      if (with_mean && !is.na(cells$nm[i]) && cells$nm[i] > 0) {
        cell$m <- round(cells$m[i], 3); cell$sd <- round(sdv[i], 3); cell$se <- round(sdv[i] / sqrt(ne_mean[i]), 4)
        if (cells$nm[i] != cells$nv[i]) cell$nm <- cells$nm[i]    # mean excludes off-scale answers
      }
    }
    if (length(nr_codes)) cell$q <- arr(Q[i, ])
    out[[i]] <- cell
  }
  names(out) <- as.character(cells$grp)
  out <- split(out, as.character(cells$cty))
  # stable order: countries alphabetical, groups in GROUP_IDS order
  out <- out[order(names(out))]
  lapply(out, function(g) g[intersect(GROUP_IDS, names(g))])
}
