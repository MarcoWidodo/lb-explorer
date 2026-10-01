"""
Independent check of the site data (public/data) against the raw .sav files.

A second implementation, in Python (pyreadstat + numpy), recomputes a random
sample of published numbers from scratch:
  • single-wave cells: valid-base %, nonresponse % (asked base), N, mean, for
    all respondents AND for subgroups (gender, age, education, urban/rural)
  • harmonized trend cells from HarmonizedMerge_v1.sav
  • within-country weighted correlations
It trusts only the code lists written in each file (which codes are valid /
nonresponse); every sum, weight and subgroup is rebuilt here.

Usage:  ABS_DATA_DIR=".../Asian Barometer Data" python3 pipeline/verify_site_data.py [n_samples]
Exit code 1 if any difference exceeds rounding.
"""
import json, os, random, sys
import numpy as np
import pyreadstat

DATA = os.environ.get("ABS_DATA_DIR", os.path.expanduser("~/Desktop/Larry RA/Asian Barometer Data"))
SITE = os.path.join(os.path.dirname(__file__), "..", "public", "data")
N = int(sys.argv[1]) if len(sys.argv) > 1 else 400
WEIGHT = {1: "w_all", 2: "w_all", 3: "allweight", 4: "w", 5: "w", 6: "w"}
URBAN = {1: "level3", 2: "level3", 3: "level3", 4: "level", 5: "level", 6: "level"}
random.seed(2026)

man = json.load(open(os.path.join(SITE, "manifest.json")))
iso_of = {}
codes_csv = os.path.join(os.path.dirname(__file__), "config", "countries.csv")
for line in open(codes_csv).read().splitlines()[1:]:
    code, iso2 = line.split(",")[:2]
    iso_of[float(code)] = iso2

hm, hm_meta = pyreadstat.read_sav(os.path.join(DATA, "HarmonizedMerge_v1.sav"))
waves = {}
for w in range(1, 7):
    df, meta = pyreadstat.read_sav(os.path.join(DATA, f"Wave{w}.sav"), user_missing=True)
    df.columns = [c.lower() for c in df.columns]
    meta_labels = {k.lower(): v for k, v in meta.variable_value_labels.items()}
    waves[w] = (df, meta_labels)

def groups_for(w, h, df, labels):
    """Boolean masks for every subgroup, rebuilt from HarmonizedMerge + raw urban labels."""
    g, a, e = h["se_gender"].values, h["se_age"].values, h["se_education"].values
    ulab = labels.get(URBAN[w], {})
    uv = df[URBAN[w]].map(lambda v: str(ulab.get(v, "")).strip().lower()).values
    return {
        "all": np.ones(len(df), bool),
        "men": g == 1, "women": g == 2,
        "age18": (a >= 0) & (a <= 29), "age30": (a >= 30) & (a <= 44), "age45": (a >= 45) & (a <= 59), "age60": (a >= 60) & (a <= 120),
        "edu_low": np.isin(e, [1, 2, 3]), "edu_mid": np.isin(e, [4, 5, 6, 7]), "edu_high": np.isin(e, [8, 9]),
        "urban": uv == "urban", "rural": uv == "rural",
    }

fails, stats = [], {"cells": 0, "max_p": 0, "max_q": 0, "max_m": 0, "trend": 0, "max_tm": 0, "corr": 0, "max_r": 0}

# ---- single-wave cells -----------------------------------------------------
for _ in range(N):
    w = random.randint(1, 6)
    df, labels = waves[w]
    h = hm[hm["wave"] == w].reset_index(drop=True)
    idx = json.load(open(os.path.join(SITE, "waves", f"w{w}", "index.json")))
    v = random.choice([x for x in idx["vars"] if x["t"] != "continuous"])
    rec = json.load(open(os.path.join(SITE, "waves", f"w{w}", "v", v["id"] + ".json")))
    cc = random.choice(list(rec["est"].keys()))
    grp = random.choice(list(rec["est"][cc].keys()))
    cell = rec["est"][cc][grp]
    x = df[v["id"]].values.astype(float)
    wt = df[WEIGHT[w]].values.astype(float)
    ctry = np.array([iso_of.get(c) for c in df["country"].values])
    mask = (ctry == cc) & groups_for(w, h, df, labels)[grp]
    valid = mask & np.isin(x, rec["codes"])
    nr = mask & np.isin(x, rec["nr"])
    asked = valid | nr
    if cell["n"] != asked.sum() or cell["nv"] != valid.sum():
        fails.append(("N", w, v["id"], cc, grp, cell["n"], int(asked.sum()), cell["nv"], int(valid.sum()))); continue
    stats["cells"] += 1
    if cell["nv"]:
        codes = cell.get("k", rec["codes"])
        for code, p in zip(codes, cell["p"]):
            mine = 100 * wt[valid & (x == code)].sum() / wt[valid].sum()
            stats["max_p"] = max(stats["max_p"], abs(mine - p))
        if "m" in cell:
            on = valid & ~np.isin(x, rec.get("offscale", []))
            m = np.average(x[on], weights=wt[on])
            stats["max_m"] = max(stats["max_m"], abs(m - cell["m"]))
    for code, q in zip(rec["nr"], cell.get("q", [])):
        mine = 100 * wt[nr & (x == code)].sum() / wt[asked].sum()
        stats["max_q"] = max(stats["max_q"], abs(mine - q))

# ---- harmonized trends -----------------------------------------------------
tidx = json.load(open(os.path.join(SITE, "trends", "index.json")))
for _ in range(N // 2):
    it = random.choice(tidx["items"])
    rec = json.load(open(os.path.join(SITE, "trends", it["id"] + ".json")))
    w = random.choice(list(rec["waves"].keys()))
    cc = random.choice(list(rec["waves"][w].keys()))
    grp = random.choice(list(rec["waves"][w][cc].keys()))
    cell = rec["waves"][w][cc][grp]
    df, labels = waves[int(w)]
    h = hm[hm["wave"] == int(w)].reset_index(drop=True)
    x = h[it["id"]].values
    mask = (np.array([iso_of.get(c) for c in h["country"].values]) == cc) & groups_for(int(w), h, df, labels)[grp] & ~np.isnan(x)
    if cell["nv"] != mask.sum():
        fails.append(("trend N", it["id"], w, cc, grp, cell["nv"], int(mask.sum()))); continue
    m = np.average(x[mask], weights=h["weight"].values[mask])
    stats["trend"] += 1
    stats["max_tm"] = max(stats["max_tm"], abs(m - cell["m"]))

# ---- correlations ----------------------------------------------------------
for _ in range(N // 2):
    w = random.randint(1, 6)
    df, _ = waves[w]
    idx = json.load(open(os.path.join(SITE, "waves", f"w{w}", "index.json")))
    a, b = random.sample(idx["corr"], 2)
    rr = json.load(open(os.path.join(SITE, "waves", f"w{w}", "r", a + ".json")))
    if not rr["r"]:
        fails.append(("corr file with no countries", w, a)); continue
    cc = random.choice(list(rr["r"].keys()))
    r_pub = rr["r"][cc][idx["corr"].index(b)]
    ra = json.load(open(os.path.join(SITE, "waves", f"w{w}", "v", a + ".json")))
    rb = json.load(open(os.path.join(SITE, "waves", f"w{w}", "v", b + ".json")))
    def scale(rec):
        off = set(rec.get("offscale", []))
        return [c for c in rec["codes"] if c not in off]
    xa, xb = df[a].values.astype(float), df[b].values.astype(float)
    ctry = np.array([iso_of.get(c) for c in df["country"].values])
    cont_a, cont_b = ra["type"] == "continuous", rb["type"] == "continuous"
    va = (np.isin(xa, scale(ra)) if not cont_a else ~np.isnan(xa) & (xa >= ra["range"][0]) & (xa <= ra["range"][1]))
    vb = (np.isin(xb, scale(rb)) if not cont_b else ~np.isnan(xb) & (xb >= rb["range"][0]) & (xb <= rb["range"][1]))
    va &= ~np.isin(xa, ra["nr"]); vb &= ~np.isin(xb, rb["nr"])
    m = (ctry == cc) & va & vb
    if m.sum() < 30:
        if r_pub is not None: fails.append(("corr n<30 but r published", w, a, b, cc))
        continue
    wt = df[WEIGHT[w]].values.astype(float)[m]
    X, Y = xa[m], xb[m]
    mx, my = np.average(X, weights=wt), np.average(Y, weights=wt)
    cov = np.average((X - mx) * (Y - my), weights=wt)
    sx, sy = np.sqrt(np.average((X - mx) ** 2, weights=wt)), np.sqrt(np.average((Y - my) ** 2, weights=wt))
    if sx == 0 or sy == 0 or r_pub is None: continue
    stats["corr"] += 1
    d_r = abs(cov / (sx * sy) - r_pub / 1000)
    if d_r > stats["max_r"]:
        stats["max_r"] = d_r; stats["worst_r"] = [w, a, b, cc, ra["type"], rb["type"], r_pub, round(cov / (sx * sy), 5)]

print(json.dumps(stats, indent=1))
ok = not fails and stats["max_p"] <= 0.051 and stats["max_q"] <= 0.051 and stats["max_m"] <= 0.00051 \
     and stats["max_tm"] <= 0.00051 and stats["max_r"] <= 0.00051
if fails:
    print("FAILURES:", *fails[:20], sep="\n  ")
print("ALL CHECKS PASSED" if ok else "CHECKS FAILED")
sys.exit(0 if ok else 1)
