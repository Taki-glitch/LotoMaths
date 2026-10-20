// Fonctions mathématiques centrales (source unique de calcul pour toutes les pages).
export const REGIMES = [
  { id: '5-49-1-10', label: '5 numéros parmi 49 + numéro Chance parmi 10', from: '2008-10-06', to: null, main: 5, mainMax: 49, chanceMax: 10 },
];
export const regimeFor = (date) => REGIMES.find((r) => date >= r.from && (!r.to || date <= r.to)) || null;

/** C(n,k) exact (BigInt). */
export function comb(n, k) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0 || k > n) return 0n;
  k = Math.min(k, n - k);
  let r = 1n;
  for (let i = 1; i <= k; i++) r = (r * BigInt(n - k + i)) / BigInt(i);
  return r;
}
/** Rapport de deux BigInt en flottant, sans dépassement. */
export function ratio(a, b) {
  const s = 10n ** 30n;
  return Number((a * s) / b) / 1e30;
}
export const fmtBig = (x) => x.toLocaleString('fr-FR');
export const fmtNum = (x, d = 4) => Number(x).toLocaleString('fr-FR', { maximumFractionDigits: d });
export const fmtPct = (x, d = 3) => (x * 100).toLocaleString('fr-FR', { maximumFractionDigits: d }) + ' %';

/** P(exactement k numéros corrects) pour une grille de `main` numéros. */
export function probMatch(k, r = REGIMES[0]) {
  const fav = comb(r.main, k) * comb(r.mainMax - r.main, r.main - k);
  const total = comb(r.mainMax, r.main);
  return { fav, total, p: ratio(fav, total) };
}
/** Probabilité d'un résultat (k bons numéros, Chance bonne ou non). */
export function probOutcome(k, chance, r = REGIMES[0]) {
  const m = probMatch(k, r);
  const fav = m.fav * (chance ? 1n : BigInt(r.chanceMax - 1));
  const total = m.total * BigInt(r.chanceMax);
  return { fav, total, p: ratio(fav, total) };
}
/** Probabilité qu'un sous-ensemble précis de s numéros apparaisse dans un tirage. */
export const probSubset = (s, r = REGIMES[0]) => ratio(comb(r.mainMax - s, r.main - s), comb(r.mainMax, r.main));
/** g grilles distinctes visant la même catégorie : événements disjoints pour le jackpot, donc somme exacte. */
export const probJackpotDistinct = (g, r = REGIMES[0]) => Math.min(1, g * probOutcome(r.main, true, r).p);

// ---- Lois et tests ----
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t);
  let s = 1.000000000190015; for (const cj of c) s += cj / ++y;
  return -t + Math.log((2.5066282746310005 * s) / x);
}
/** Q(a,x) : gamma incomplète régularisée supérieure. */
export function gammaQ(a, x) {
  if (x <= 0) return 1;
  if (x < a + 1) { let ap = a, sum = 1 / a, del = sum; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; } return 1 - sum * Math.exp(-x + a * Math.log(x) - lgamma(a)); }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}
export const chi2Sf = (x, df) => gammaQ(df / 2, x / 2);
export function normCdf(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989422804014327 * Math.exp((-z * z) / 2); const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))); return z > 0 ? 1 - p : p; }

/** Khi-deux d'adéquation. Non applicable si un effectif attendu < 5. */
export function chiSquareGof(observed, expected) {
  const df = observed.length - 1;
  const minExpected = Math.min(...expected);
  const stat = observed.reduce((s, o, i) => s + (o - expected[i]) ** 2 / expected[i], 0);
  const applicable = minExpected >= 5;
  return { stat, df, minExpected, applicable, p: applicable ? chi2Sf(stat, df) : null };
}
/** Intervalle de Wilson. */
export function wilson(x, n, z = 1.959964) {
  if (n === 0) return [NaN, NaN];
  const p = x / n, z2 = z * z, den = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / den, h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
/** Test z bilatéral (approximation normale) d'un effectif contre p0. */
export function zTestProportion(x, n, p0) {
  const z = (x - n * p0) / Math.sqrt(n * p0 * (1 - p0));
  return { z, p: 2 * (1 - normCdf(Math.abs(z))) };
}
export function twoProportionZ(x1, n1, x2, n2) {
  const p = (x1 + x2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  const z = (x1 / n1 - x2 / n2) / se;
  return { z, p: 2 * (1 - normCdf(Math.abs(z))) };
}
export const bonferroni = (ps) => ps.map((p) => Math.min(1, p * ps.length));
export function benjaminiHochberg(ps) {
  const m = ps.length, idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(m);
  let prev = 1;
  for (let k = m; k >= 1; k--) { const [p, i] = idx[k - 1]; prev = Math.min(prev, (p * m) / k); out[i] = prev; }
  return out;
}
