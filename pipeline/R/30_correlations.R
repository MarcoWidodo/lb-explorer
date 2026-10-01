# =============================================================================
# 30_correlations.R: weighted pairwise Pearson correlations within each country
#
# For every pair of eligible variables (ordinal, binary, continuous) and every
# country: weighted Pearson r over respondents valid on BOTH items (pairwise
# deletion), and the unweighted pairwise N. Computed with matrix algebra so a
# wave takes seconds:
#   SW  = Mᵀ diag(w) M          (sum of weights over pairwise-valid rows)
#   SX  = (X∘w)ᵀ M              (SX[j,k] = Σ w x_j over rows valid on j and k)
#   SXX = (X²∘w)ᵀ M
#   SXY = (X∘w)ᵀ X              (X has 0 where missing)
#   cov = SXY/SW − (SX/SW)(SXᵀ/SW); var_j = SXX/SW − (SX/SW)²
# p-values are computed in the browser from r and N (two-sided t-test, df = N − 2).
# =============================================================================

MIN_PAIR_N <- 30

weighted_pairwise_cor <- function(X, w) {
  M <- !is.na(X) * 1
  X0 <- X; X0[is.na(X0)] <- 0
  Mw <- M * w
  SW  <- crossprod(Mw, M)
  SX  <- crossprod(X0 * w, M)
  SXX <- crossprod(X0^2 * w, M)
  SXY <- crossprod(X0 * w, X0)
  N   <- crossprod(M)
  mx <- SX / SW; my <- t(SX) / SW
  cv <- SXY / SW - mx * my
  vx <- SXX / SW - mx^2; vy <- t(SXX) / SW - my^2
  r <- cv / sqrt(vx * vy)
  r[N < MIN_PAIR_N | vx <= 1e-12 | vy <= 1e-12 | !is.finite(r)] <- NA
  r[r > 1] <- 1; r[r < -1] <- -1
  list(r = r, n = N)
}

# Reference implementation used by the build checks (stats::cov.wt on complete pairs)
cor_reference <- function(x, y, w) {
  ok <- !is.na(x) & !is.na(y)
  cov.wt(cbind(x[ok], y[ok]), wt = w[ok] / sum(w[ok]), cor = TRUE, method = "ML")$cor[1, 2]
}
