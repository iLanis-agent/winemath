// Winemath engine: home winemaking must and wine corrections.
// Conversions and rules of thumb are the commonly published home-winemaking
// values (labeled in the UI); the SO2 fraction is the published equilibrium
// formula with pKa 1.81. Ideal-solution model: ignores temperature effects,
// volume change from additions, and lab measurement error.
var BRIX_PER_SG = 258.6;      // published approximation: Brix = (SG - 1) * 258.6 near 1.000-1.120
var ABV_PER_BRIX = 0.55;      // published rule: potential ABV = Brix * 0.55 (0.55-0.59 in sources)
var GRAVITY_ABV = 131.25;     // published: ABV = (OG - FG) * 131.25
var SUGAR_G_L_PER_BRIX = 10;  // 1 Brix = 10 g sugar per liter of must (definition, ideal volume)
var TARTARIC_PER_TA = 1.0;    // published rule: 1 g/L tartaric acid raises TA by ~1 g/L
var CACO3_PER_TA = 1.0;       // published rule: 1 g/L calcium carbonate lowers TA by ~1 g/L
var KHCO3_EFF = 0.6;          // published rule: 1 g/L potassium bicarbonate lowers TA by ~0.6 g/L
var SO2_PKA = 1.81;           // published pKa of sulfurous acid in wine
var KMS_FRACTION = 0.576;     // published: potassium metabisulfite is ~57.6% SO2 by weight
var MOLECULAR_TARGET = { red: 0.5, white: 0.8 }; // published targets, ppm molecular SO2

function bad(v) { return !(typeof v === 'number' && isFinite(v)); }

function brixToSG(brix) {
  if (bad(brix) || brix < 0 || brix > 60) return { error: 'Brix must be a number between 0 and 60.' };
  return { sg: 1 + brix / BRIX_PER_SG };
}
function sgToBrix(sg) {
  if (bad(sg) || sg < 0.99 || sg > 1.25) return { error: 'Specific gravity must be between 0.99 and 1.25.' };
  return { brix: (sg - 1) * BRIX_PER_SG };
}
function potentialABV(brix) {
  if (bad(brix) || brix < 0 || brix > 60) return { error: 'Brix must be a number between 0 and 60.' };
  return { abv: brix * ABV_PER_BRIX };
}
function abvFromGravity(og, fg) {
  if (bad(og) || bad(fg) || og < 0.99 || og > 1.25 || fg < 0.98 || fg > og) {
    return { error: 'OG must be 0.99-1.25 and FG no higher than OG.' };
  }
  return { abv: (og - fg) * GRAVITY_ABV, attenuation: (og - fg) / (og - 1) * 100 };
}
// grams of sugar to raise the must from curBrix to targetBrix (ideal volume)
function chapitalization(volL, curBrix, targetBrix) {
  if (bad(volL) || volL <= 0 || bad(curBrix) || bad(targetBrix) || curBrix < 0 || targetBrix > 60) {
    return { error: 'Volume must be positive and Brix values within 0-60.' };
  }
  var d = targetBrix - curBrix;
  if (d < 0) return { error: 'Target Brix is below the current reading - sugar cannot be removed; dilute instead.' };
  return { grams: volL * d * SUGAR_G_L_PER_BRIX, deltaBrix: d, abvGain: d * ABV_PER_BRIX };
}
// acid correction: raise with tartaric, lower with calcium carbonate or potassium bicarbonate
function acidAdjust(volL, curTA, targetTA, chem) {
  if (bad(volL) || volL <= 0 || bad(curTA) || bad(targetTA) || curTA < 0 || targetTA < 0) {
    return { error: 'Volume must be positive and TA values zero or more.' };
  }
  var d = targetTA - curTA;
  if (d > 0) return { direction: 'raise', grams: volL * d * TARTARIC_PER_TA, name: 'tartaric acid', delta: d };
  if (d < 0) {
    var per = chem === 'khco3' ? KHCO3_EFF : CACO3_PER_TA;
    return { direction: 'lower', grams: volL * (-d) / per, name: chem === 'khco3' ? 'potassium bicarbonate' : 'calcium carbonate', delta: -d };
  }
  return { direction: 'none', grams: 0, name: 'nothing', delta: 0 };
}
// SO2 management: molecular fraction from pH (published equilibrium, pKa 1.81)
function so2Plan(pH, style, volL) {
  if (bad(pH) || pH < 2.5 || pH > 4.5) return { error: 'pH must be a number between 2.5 and 4.5.' };
  if (bad(volL) || volL <= 0) return { error: 'Volume must be positive.' };
  var target = MOLECULAR_TARGET[style] || MOLECULAR_TARGET.red;
  var frac = 1 / (1 + Math.pow(10, pH - SO2_PKA));
  var freeNeeded = target / frac; // ppm free SO2 for the molecular target
  return {
    molecularTarget: target, fraction: frac, freePpm: freeNeeded,
    kmsGrams: freeNeeded * volL / 1000 / KMS_FRACTION,
    note: 'Published targets: ' + target + ' ppm molecular SO2 for ' + (style === 'white' ? 'white' : 'red') + ' wine. Potassium metabisulfite taken as 57.6% SO2 by weight.'
  };
}
// fortification by Pearson's square: parts spirit per parts wine = (T - A) / (B - T)
function fortify(volWine, abvWine, abvSpirit, targetAbv) {
  if (bad(volWine) || volWine <= 0 || bad(abvWine) || bad(abvSpirit) || bad(targetAbv)) {
    return { error: 'Volumes and ABV values must be numbers, volume positive.' };
  }
  if (targetAbv <= abvWine) return { error: 'Target ABV must be above the wine ABV - fortification only raises strength.' };
  if (targetAbv >= abvSpirit) return { error: 'Target ABV must be below the spirit ABV.' };
  var per = (targetAbv - abvWine) / (abvSpirit - targetAbv); // spirit volume per wine volume
  return {
    spiritPerWine: per, spiritVol: volWine * per,
    finalVol: volWine * (1 + per),
    note: 'Pearson\'s square: ' + fmt1(targetAbv - abvWine) + ' parts spirit to ' + fmt1(abvSpirit - targetAbv) + ' parts wine (published blending rule).'
  };
}
// blend two wines: weighted average of ABV (or any per-volume property)
function blend(v1, p1, v2, p2) {
  if (bad(v1) || v1 <= 0 || bad(v2) || v2 <= 0 || bad(p1) || bad(p2)) {
    return { error: 'Volumes must be positive and property values numeric.' };
  }
  return { result: (v1 * p1 + v2 * p2) / (v1 + v2), totalVol: v1 + v2 };
}
// water-back dilution: water to add to bring ABV from a1 to a2
function dilute(vol, a1, a2) {
  if (bad(vol) || vol <= 0 || bad(a1) || bad(a2) || a2 >= a1 || a2 <= 0) {
    return { error: 'Volume positive; target ABV must be above zero and below the current ABV.' };
  }
  return { water: vol * (a1 - a2) / a2, finalVol: vol * a1 / a2 };
}
function fmt1(v) { return Math.round(v * 10) / 10; }

var engine = {
  brixToSG: brixToSG, sgToBrix: sgToBrix, potentialABV: potentialABV,
  abvFromGravity: abvFromGravity, chapitalization: chapitalization,
  acidAdjust: acidAdjust, so2Plan: so2Plan, fortify: fortify,
  blend: blend, dilute: dilute,
  CONST: { BRIX_PER_SG: BRIX_PER_SG, ABV_PER_BRIX: ABV_PER_BRIX, GRAVITY_ABV: GRAVITY_ABV,
    SO2_PKA: SO2_PKA, KMS_FRACTION: KMS_FRACTION, MOLECULAR_TARGET: MOLECULAR_TARGET }
};
if (typeof module !== 'undefined') module.exports = engine;
