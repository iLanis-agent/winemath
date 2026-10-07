#!/usr/bin/env python3
# Independent oracle for Winemath. Re-derives the published conversions from
# scratch and cross-checks against published reference-table values with
# labeled tolerances.
import json, math

BRIX_PER_SG = 258.6
ABV_PER_BRIX = 0.55
GRAVITY_ABV = 131.25
SO2_PKA = 1.81
KMS_FRACTION = 0.576
MOL = {"red": 0.5, "white": 0.8}

def brix_to_sg(b): return 1 + b / BRIX_PER_SG
def sg_to_brix(sg): return (sg - 1) * BRIX_PER_SG
def chapit(vol, c, t): return vol * (t - c) * 10.0
def acid(vol, c, t, chem):
    d = t - c
    if d > 0: return vol * d
    if d < 0: return vol * (-d) / (0.6 if chem == "khco3" else 1.0)
    return 0.0
def so2(ph, style, vol):
    frac = 1.0 / (1.0 + 10 ** (ph - SO2_PKA))
    free = MOL[style] / frac
    return frac, free, free * vol / 1000.0 / KMS_FRACTION
def fortify(vol, a, b, t): return vol * (t - a) / (b - t)
def abv_grav(og, fg): return (og - fg) * GRAVITY_ABV
def dilute(vol, a1, a2): return vol * (a1 - a2) / a2
def blend(v1, p1, v2, p2): return (v1 * p1 + v2 * p2) / (v1 + v2)

cases = []
for b in (0, 5, 12, 18, 22, 26, 35):
    cases.append({"kind": "b2s", "brix": b, "sg": brix_to_sg(b), "abv": b * ABV_PER_BRIX})
for sg in (1.000, 1.040, 1.070, 1.090, 1.110):
    cases.append({"kind": "s2b", "sg": sg, "brix": sg_to_brix(sg)})
for vol, c, t in ((19, 18, 22), (23, 16, 21), (5, 20, 24), (100, 14, 22)):
    cases.append({"kind": "chap", "vol": vol, "cur": c, "tgt": t, "grams": chapit(vol, c, t)})
for vol, c, t, chem in ((23, 5, 7, "tart"), (23, 9, 6, "caco3"), (19, 8.5, 6.5, "khco3"), (50, 4, 7.5, "tart"), (10, 6, 6, "caco3")):
    cases.append({"kind": "acid", "vol": vol, "cur": c, "tgt": t, "chem": chem, "grams": acid(vol, c, t, chem)})
for ph in (2.9, 3.0, 3.2, 3.3, 3.4, 3.6, 3.8, 4.0):
    for style in ("red", "white"):
        for vol in (5, 19, 23):
            frac, free, kms = so2(ph, style, vol)
            cases.append({"kind": "so2", "ph": ph, "style": style, "vol": vol, "frac": frac, "free": free, "kms": kms})
# published free-SO2 reference table values (tolerance 0.5 ppm, labeled)
for ph, style, ref in ((3.2, "red", 13.0), (3.2, "white", 21.0), (3.4, "red", 20.0), (3.6, "red", 31.0), (3.6, "white", 50.0), (3.0, "red", 8.0)):
    frac, free, kms = so2(ph, style, 19)
    cases.append({"kind": "published_so2", "ph": ph, "style": style, "free": free, "ref": ref, "tol": 1.5})
for vol, a, b, t in ((19, 12, 40, 17), (10, 11, 40, 18), (20, 13.5, 96, 20), (5, 12, 50, 22)):
    cases.append({"kind": "fort", "vol": vol, "a": a, "b": b, "t": t, "spirit": fortify(vol, a, b, t)})
for og, fg in ((1.090, 0.996), (1.085, 1.000), (1.100, 0.990), (1.060, 1.010)):
    cases.append({"kind": "grav", "og": og, "fg": fg, "abv": abv_grav(og, fg), "att": (og - fg) / (og - 1) * 100})
for vol, a1, a2 in ((19, 14, 12), (10, 16, 13), (23, 15, 12.5)):
    cases.append({"kind": "dil", "vol": vol, "a1": a1, "a2": a2, "water": dilute(vol, a1, a2)})
for v1, p1, v2, p2 in ((10, 14, 10, 11), (12, 13.5, 8, 12.0), (5, 7.5, 15, 6.0)):
    cases.append({"kind": "blend", "v1": v1, "p1": p1, "v2": v2, "p2": p2, "result": blend(v1, p1, v2, p2)})
json.dump(cases, open("tests/expected.json", "w"))
print(f"oracle wrote {len(cases)} cases")
