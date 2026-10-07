const E = require('../engine.js');
const cases = require('./expected.json');
let pass = 0, fail = 0;
const TOL = 1e-9;
function chk(ok, label, got, want) {
  if (ok) pass++;
  else { fail++; console.error('FAIL', label, 'got', got, 'want', want); }
}
for (const c of cases) {
  if (c.kind === 'b2s') {
    chk(Math.abs(E.brixToSG(c.brix).sg - c.sg) < TOL, `b2s ${c.brix}`, E.brixToSG(c.brix).sg, c.sg);
    chk(Math.abs(E.potentialABV(c.brix).abv - c.abv) < TOL, `abv ${c.brix}`, E.potentialABV(c.brix).abv, c.abv);
  } else if (c.kind === 's2b') {
    chk(Math.abs(E.sgToBrix(c.sg).brix - c.brix) < TOL, `s2b ${c.sg}`, E.sgToBrix(c.sg).brix, c.brix);
  } else if (c.kind === 'chap') {
    chk(Math.abs(E.chapitalization(c.vol, c.cur, c.tgt).grams - c.grams) < TOL, `chap ${c.vol} ${c.cur}->${c.tgt}`, E.chapitalization(c.vol, c.cur, c.tgt).grams, c.grams);
  } else if (c.kind === 'acid') {
    const r = E.acidAdjust(c.vol, c.cur, c.tgt, c.chem);
    chk(Math.abs(r.grams - c.grams) < TOL, `acid ${c.vol} ${c.cur}->${c.tgt} ${c.chem}`, r.grams, c.grams);
  } else if (c.kind === 'so2') {
    const r = E.so2Plan(c.ph, c.style, c.vol);
    chk(Math.abs(r.fraction - c.frac) < TOL && Math.abs(r.freePpm - c.free) < TOL && Math.abs(r.kmsGrams - c.kms) < TOL,
      `so2 ${c.ph} ${c.style} ${c.vol}`, [r.fraction, r.freePpm, r.kmsGrams], [c.frac, c.free, c.kms]);
  } else if (c.kind === 'published_so2') {
    const r = E.so2Plan(c.ph, c.style, 19);
    chk(Math.abs(r.freePpm - c.ref) < c.tol, `published so2 ${c.ph} ${c.style}`, r.freePpm, c.ref);
  } else if (c.kind === 'fort') {
    chk(Math.abs(E.fortify(c.vol, c.a, c.b, c.t).spiritVol - c.spirit) < TOL, `fort ${c.vol} ${c.a}->${c.t}@${c.b}`, E.fortify(c.vol, c.a, c.b, c.t).spiritVol, c.spirit);
  } else if (c.kind === 'grav') {
    const r = E.abvFromGravity(c.og, c.fg);
    chk(Math.abs(r.abv - c.abv) < TOL && Math.abs(r.attenuation - c.att) < 1e-6, `grav ${c.og}->${c.fg}`, [r.abv, r.attenuation], [c.abv, c.att]);
  } else if (c.kind === 'dil') {
    chk(Math.abs(E.dilute(c.vol, c.a1, c.a2).water - c.water) < TOL, `dil ${c.vol} ${c.a1}->${c.a2}`, E.dilute(c.vol, c.a1, c.a2).water, c.water);
  } else if (c.kind === 'blend') {
    chk(Math.abs(E.blend(c.v1, c.p1, c.v2, c.p2).result - c.result) < TOL, `blend`, E.blend(c.v1, c.p1, c.v2, c.p2).result, c.result);
  }
}
// error paths
const errs = [
  E.brixToSG(-1).error, E.brixToSG(99).error, E.sgToBrix(2).error,
  E.potentialABV('x').error, E.abvFromGravity(1.05, 1.06).error,
  E.chapitalization(0, 10, 20).error, E.chapitalization(19, 22, 18).error,
  E.acidAdjust(-5, 5, 7).error, E.acidAdjust(19, -1, 5).error,
  E.so2Plan(2.0, 'red', 19).error, E.so2Plan(3.2, 'red', 0).error,
  E.fortify(19, 12, 40, 10).error, E.fortify(19, 12, 40, 45).error,
  E.blend(0, 12, 5, 10).error, E.dilute(19, 12, 14).error, E.dilute(19, 12, 0).error
];
errs.forEach((e, i) => chk(typeof e === 'string' && e.length > 5, 'error path ' + i, e, 'error string'));
// properties: conversion round-trip; fortify result hits target ABV by volume balance
chk(Math.abs(E.sgToBrix(E.brixToSG(22).sg).brix - 22) < TOL, 'roundtrip', E.sgToBrix(E.brixToSG(22).sg).brix, 22);
const f = E.fortify(19, 12, 40, 17);
const checkAbv = (19 * 12 + f.spiritVol * 40) / (19 + f.spiritVol);
chk(Math.abs(checkAbv - 17) < 1e-9, 'fortify balance', checkAbv, 17);
const d = E.dilute(19, 14, 12);
chk(Math.abs((19 * 14) / (19 + d.water) - 12) < 1e-9, 'dilute balance', (19 * 14) / (19 + d.water), 12);
console.log(`${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
