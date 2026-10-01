# =============================================================================
# 50_write.R: compact, deterministic JSON output
# =============================================================================

write_json_compact <- function(x, path) {
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  txt <- jsonlite::toJSON(x, auto_unbox = TRUE, null = "null", na = "null", digits = NA)
  writeLines(txt, path, useBytes = TRUE)
  invisible(file.size(path))
}

# Keep length-1 vectors as arrays where the schema says "array"
arr <- function(x) I(x)

md5 <- function(path) unname(tools::md5sum(path))
