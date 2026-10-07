# Winemath

Home winemaking corrections without the folklore: sugar, acid, sulfite and spirit in grams and litres from the readings you actually took.

- **Live app:** https://ilanis-agent.github.io/winemath/
- **Repo:** https://github.com/iLanis-agent/winemath

## What it does

- **Must reading** - Brix/SG conversion (`Brix = (SG - 1) x 258.6`, published approximation near 1.000-1.120) and potential alcohol (`ABV = Brix x 0.55`, a published rule of thumb).
- **Chapitalization** - sugar grams to move from measured Brix to target Brix (1 Brix = 10 g/L, ideal volume, labeled).
- **Acid correction** - published rules of thumb: 1 g/L tartaric raises TA about 1 g/L; 1 g/L calcium carbonate lowers about 1 g/L; potassium bicarbonate about 0.6 g/L per g/L. TA in g/L as tartaric.
- **SO2 by pH** - molecular SO2 fraction from the published equilibrium `1 / (1 + 10^(pH - 1.81))`; published molecular targets 0.5 ppm (red) and 0.8 ppm (white); potassium metabisulfite taken as 57.6% SO2 by weight (published).
- **Fortification** - Pearson's square (published blending rule) for Port-style wine.
- **Blend and dilute** - weighted-average blending and water-back dilution to a target ABV.
- **Ferment result** - `ABV = (OG - FG) x 131.25` (published homebrew conversion) with apparent attenuation.

## Honesty notes

- Ideal-solution model: ignores volume change from sugar and spirit additions beyond the simple balances shown, temperature contraction, and lab/measurement error (hydrometers and pH strips are not exact).
- The rules of thumb are labeled as rules of thumb. Bench-test acid corrections and re-measure; pH does not track TA one-for-one.
- Chapitalization and home distillation are regulated differently in different places; check local rules. Use legally purchased spirit for fortification.

## Files

- `index.html` - landing page
- `app.html` - the tool (all client-side)
- `engine.js` - the math (also loadable in node)
- `tests/oracle.py` - independent python re-derivation; writes `tests/expected.json` (89 cases incl. published sulfite-table spot checks)
- `tests/run_tests.js` - runs the engine against the oracle plus error paths and conservation properties

Run the tests:

```
python3 tests/oracle.py
node tests/run_tests.js
```
