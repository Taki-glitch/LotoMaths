// Statistiques descriptives et structurelles.
import { comb, ratio, REGIMES } from './maths.js';
export const sumOf = (d) => d.numeros.reduce((a, b) => a + b, 0);
export function filterDraws(draws, { from, to, last } = {}) {
  let r = draws.filter((d) => (!from || d.date >= from) && (!to || d.date <= to));
  if (last) r = r.slice(-last);
  return r;
}
export function frequencies(draws, max = 49) { const c = Array(max + 1).fill(0); for (const d of draws) for (const n of d.numeros) c[n]++; return c; }
export function chanceFrequencies(draws, max = 10) { const c = Array(max + 1).fill(0); for (const d of draws) c[d.numeroChance]++; return c; }
export function describe(a) {
  const n = a.length; if (!n) return null;
  const s = [...a].sort((x, y) => x - y), mean = a.reduce((x, y) => x + y, 0) / n;
  const q = (p) => { const i = (n - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, n - 1)] - s[lo]) * (i - lo); };
  const variance = n > 1 ? a.reduce((x, y) => x + (y - mean) ** 2, 0) / (n - 1) : 0;
  return { n, mean, median: q(0.5), variance, sd: Math.sqrt(variance), min: s[0], max: s[n - 1], q1: q(0.25), q3: q(0.75) };
}
export const sumDistribution = (draws) => { const c = {}; for (const d of draws) { const s = sumOf(d); c[s] = (c[s] || 0) + 1; } return c; };
export function parityCounts(draws) { const c = Array(6).fill(0); for (const d of draws) c[d.numeros.filter((x) => x % 2 === 0).length]++; return c; }
/** Loi hypergéométrique du nombre de pairs (24 pairs / 25 impairs parmi 1..49). */
export function parityTheory(r = REGIMES[0]) { const E = Math.floor(r.mainMax / 2), tot = comb(r.mainMax, r.main); return Array.from({ length: r.main + 1 }, (_, k) => ratio(comb(E, k) * comb(r.mainMax - E, r.main - k), tot)); }
export const gaps = (d) => d.numeros.slice(1).map((x, i) => x - d.numeros[i]);
export const hasConsecutive = (d) => gaps(d).some((g) => g === 1);
export const DEFAULT_BANDS = [[1, 10], [11, 20], [21, 30], [31, 40], [41, 49]];
export function bandDistribution(draws, bands = DEFAULT_BANDS, r = REGIMES[0]) {
  const N = draws.length;
  return bands.map(([a, b]) => ({ band: `${a}–${b}`, observed: draws.reduce((s, d) => s + d.numeros.filter((x) => x >= a && x <= b).length, 0), expected: (N * r.main * (b - a + 1)) / r.mainMax }));
}
/** Retard = nombre de tirages écoulés depuis la dernière apparition (0 = présent au dernier tirage). */
export function delays(draws, max = 49) {
  const N = draws.length, last = Array(max + 1).fill(-1);
  draws.forEach((d, i) => d.numeros.forEach((n) => (last[n] = i)));
  return last.map((l, n) => (n === 0 ? null : { n, lastDate: l >= 0 ? draws[l].date : null, delay: l >= 0 ? N - 1 - l : null }));
}
export function pairCounts(draws) {
  const m = new Map();
  for (const d of draws) { const o = d.numeros; for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) { const k = o[i] * 100 + o[j]; m.set(k, (m.get(k) || 0) + 1); } }
  return m;
}
export function tripletCounts(draws) {
  const m = new Map();
  for (const d of draws) { const o = d.numeros; for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) for (let k = j + 1; k < 5; k++) { const key = o[i] * 10000 + o[j] * 100 + o[k]; m.set(key, (m.get(key) || 0) + 1); } }
  return m;
}
export const overlap = (nums, draws, top = 3) => draws.map((d) => ({ date: d.date, common: d.numeros.filter((x) => nums.includes(x)).length, chance: d.numeroChance })).sort((a, b) => b.common - a.common).slice(0, top);
