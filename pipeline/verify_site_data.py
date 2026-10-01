"""
Independent check of the site data (public/data) against LB_TimeSeries_Clean_v1.sav.

A second implementation, in Python (pyreadstat + numpy), recomputes a random
sample of published numbers from scratch:
  - country-year cells: valid-base % per code, nonresponse % (asked base),
    asked-base % of the default answers, N, mean, for all respondents AND for
    subgroups (gender, age, education, town size)
  - trend points: the default indicator for featured questions across all years
  - within-country weighted correlations
It trusts only the code lists written in each file (which codes are valid /
nonresponse); every sum, weight and subgroup is rebuilt here from the raw
columns.

Usage:  LB_DATA_DIR=".../Latinobarometro Data" python3 pipeline/verify_site_data.py [n_samples]
Exit code 1 if any difference exceeds rounding.
"""
import json, os, random, sys
import numpy as np
import pyreadstat

DATA = os.environ.get("LB_DATA_DIR", os.path.expanduser("~/Desktop/Larry RA/Latinobarometro Data"))
SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")
N = int(sys.argv[1]) if len(sys.argv) > 1 else 500
random.seed(2026)

man = json.load(open(os.path.join(SITE, "manifest.json")))
idx = json.load(open(os.path.join(SITE, "index.json")))
iso_of = {}
for line in open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "config", "countries.csv")).read().splitlines()[1:]:
    code, iso2 = line.split(",")[:2]
    iso_of[float(code)] = iso2

# Read the clean file in blocks of columns, kept as numpy arrays (a full pandas frame
# would need ~4 GB): COLS[name] -> np.ndarray
SAV = os.path.join(DATA, "LB_TimeSeries_Clean_v1.sav")
_, meta = pyreadstat.read_sav(SAV, metadataonly=True)
names = meta.column_names
COLS = {}
for i in range(0, len(names), 120):
    block = [n for n in names[i:i + 120] if n not in ("resp_id", "country", "iso3")]
    part, _ = pyreadstat.read_sav(SAV, usecols=block, user_missing=True)
    for n in block:
        COLS[n] = part[n].values.astype(np.float64)
    del part
class _DF(dict):
    def __getitem__(self, k):
        return _Col(COLS[k])
class _Col:
    def __init__(self, a): self.values = a
df = _DF()
NROW = len(COLS["year"])
assert NROW == 457499
year = COLS["year"].astype(int)
ctry = np.array([iso_of[float(c)] for c in COLS["country_code"]])
wt = COLS["weight"].astype(float)
assert "ES" not in set(ctry)

g_, a_, e_, t_ = (COLS[c] for c in ("S_001", "S_002", "S_101", "X_008"))
GROUPS = {
    "all": np.ones(NROW, bool),
    "men": g_ == 1, "women": g_ == 2,
    "age18": (a_ >= 0) & (a_ <= 29), "age30": (a_ >= 30) & (a_ <= 44), "age45": (a_ >= 45) & (a_ <= 59), "age60": (a_ >= 60) & (a_ <= 120),
    "edu_low": np.isin(e_, [1, 2, 3]), "edu_mid": np.isin(e_, [4, 5]), "edu_high": np.isin(e_, [6, 7]),
    "town_cap": t_ == 8, "town_big": t_ == 7, "town_small": np.isin(t_, [1, 2, 3, 4, 5, 6]),
}
vars_by_id = {v["id"]: v for v in idx["vars"]}
recs = {}
def rec(v):
    if v not in recs:
        recs[v] = json.load(open(os.path.join(SITE, "v", v + ".json")))
    return recs[v]

fails = []
st = {"cells": 0, "group_cells": 0, "max_p": 0.0, "max_q": 0.0, "max_asked": 0.0, "max_m": 0.0,
      "trend_points": 0, "max_trend_share": 0.0, "max_trend_mean": 0.0, "corr": 0, "max_r": 0.0}

def masks(r, v, y, cc, grp):
    x = df[v].values.astype(float)
    base = (year == y) & (ctry == cc) & GROUPS[grp]
    if r["type"] == "continuous":
        valid = base & ~np.isnan(x) & (x >= 0) & ~np.isin(x, r["nr_raw"])
    else:
        valid = base & np.isin(x, r["codes"])
    nr = base & np.isin(x, r["nr_raw"])
    return x, valid, nr

# ---- country-year cells (all respondents and subgroups) ----------------------
for _ in range(N):
    v = random.choice(idx["vars"])
    r = rec(v["id"])
    y = random.choice(list(r["est"].keys()))
    cc = random.choice(list(r["est"][y].keys()))
    grp = "all"
    cell = r["est"][y][cc]
    if random.random() < 0.5:
        gpath = os.path.join(SITE, "g", y, v["id"] + ".json")
        if os.path.exists(gpath):
            gest = json.load(open(gpath))["est"].get(cc, {})
            if gest:
                grp = random.choice(list(gest.keys())); cell = gest[grp]
    x, valid, nr = masks(r, v["id"], int(y), cc, grp)
    asked = valid | nr
    if cell["n"] != asked.sum() or cell["nv"] != valid.sum():
        fails.append(("N", v["id"], y, cc, grp, cell["n"], int(asked.sum()), cell["nv"], int(valid.sum()))); continue
    st["cells" if grp == "all" else "group_cells"] += 1
    if r["type"] != "continuous":
        codes = cell.get("k", r["codes"])
        for code, p in zip(codes, cell["p"]):
            mine = 100 * wt[valid & (x == code)].sum() / wt[valid].sum()
            st["max_p"] = max(st["max_p"], abs(mine - p))
        d = vars_by_id[v["id"]]["d"]
        if d["type"] == "share":
            pub = sum(p for code, p in zip(codes, cell["p"]) if code in d["codes"]) * (1 - sum(cell.get("q", [0])) / 100)
            mine = 100 * wt[valid & np.isin(x, d["codes"])].sum() / wt[asked].sum()
            st["max_asked"] = max(st["max_asked"], abs(mine - pub) / max(1, len(d["codes"])))
    if "m" in cell:
        on = valid & ~np.isin(x, r.get("offscale", []))
        st["max_m"] = max(st["max_m"], abs(np.average(x[on], weights=wt[on]) - cell["m"]))
    for q in cell.get("q", []):
        mine = 100 * wt[nr].sum() / wt[asked].sum()
        st["max_q"] = max(st["max_q"], abs(mine - q))

# ---- trend points: featured questions, every country-year --------------------
for v in [x for x in idx["vars"] if x.get("f")]:
    r = rec(v["id"]); d = v["d"]
    xv = df[v["id"]].values.astype(float)
    for y, yy in r["est"].items():
        for cc, cell in yy.items():
            m = (year == int(y)) & (ctry == cc)
            valid = m & np.isin(xv, r["codes"])
            st["trend_points"] += 1
            if d["type"] == "mean":
                on = valid & ~np.isin(xv, r.get("offscale", []))
                st["max_trend_mean"] = max(st["max_trend_mean"], abs(np.average(xv[on], weights=wt[on]) - cell["m"]))
            else:   # percentage points, per answer summed (each published % is rounded to 0.1)
                codes = cell.get("k", r["codes"])
                pub = sum(p for code, p in zip(codes, cell["p"]) if code in d["codes"])
                mine = 100 * wt[valid & np.isin(xv, d["codes"])].sum() / wt[valid].sum()
                st["max_trend_share"] = max(st["max_trend_share"], abs(mine - pub) / len(d["codes"]))

# ---- correlations ------------------------------------------------------------
years = [str(w["id"]) for w in man["waves"]]
for _ in range(N // 2):
    y = random.choice(years)
    corr = json.load(open(os.path.join(SITE, "r", y, "index.json")))["corr"]
    a, b = random.sample(corr, 2)
    rr = json.load(open(os.path.join(SITE, "r", y, a + ".json")))
    cc = random.choice(list(rr["r"].keys()))
    j = corr.index(b)
    r_pub = rr["r"][cc][j]
    n_pub = rr["n0"][cc] - rr["dn"][cc][j]
    ra, rb = rec(a), rec(b)
    def onscale(r, v):
        x = df[v].values.astype(float)
        if r["type"] == "continuous":
            return x, ~np.isnan(x) & (x >= r["range"][0]) & (x <= r["range"][1])
        off = set(r.get("offscale", []))
        return x, np.isin(x, [c for c in r["codes"] if c not in off])
    xa, va = onscale(ra, a); xb, vb = onscale(rb, b)
    m = (year == int(y)) & (ctry == cc) & va & vb
    if m.sum() != n_pub:
        fails.append(("corr N", y, a, b, cc, n_pub, int(m.sum()))); continue
    if m.sum() < 30:
        if r_pub is not None: fails.append(("corr n<30 but r published", y, a, b, cc))
        continue
    w = wt[m]; X, Y = xa[m], xb[m]
    mx, my = np.average(X, weights=w), np.average(Y, weights=w)
    sx, sy = np.sqrt(np.average((X - mx) ** 2, weights=w)), np.sqrt(np.average((Y - my) ** 2, weights=w))
    if sx == 0 or sy == 0 or r_pub is None: continue
    st["corr"] += 1
    st["max_r"] = max(st["max_r"], abs(np.average((X - mx) * (Y - my), weights=w) / (sx * sy) - r_pub / 1000))

print(json.dumps(st, indent=1))
ok = (not fails and st["max_p"] <= 0.051 and st["max_q"] <= 0.051 and st["max_asked"] <= 0.101
      and st["max_m"] <= 0.00051 and st["max_trend_share"] <= 0.051 and st["max_trend_mean"] <= 0.00051 and st["max_r"] <= 0.00051
      and st["cells"] + st["group_cells"] >= 0.9 * N and st["corr"] >= N // 4)
if fails:
    print("FAILURES:", *fails[:20], sep="\n  ")
print("ALL CHECKS PASSED" if ok else "CHECKS FAILED")
sys.exit(0 if ok else 1)
