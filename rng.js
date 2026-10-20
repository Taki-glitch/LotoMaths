// Générateur pseudo-aléatoire mulberry32 (rapide, reproductible, NON cryptographique).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] >>> 0;
/** Tirage uniforme sans remise (Fisher-Yates partiel), trié. */
export function drawNumbers(rng, k = 5, max = 49) {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  for (let i = 0; i < k; i++) { const j = i + Math.floor(rng() * (max - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, k).sort((a, b) => a - b);
}
export const drawChance = (rng, max = 10) => 1 + Math.floor(rng() * max);
export function simulate(n, seed, r = { main: 5, mainMax: 49, chanceMax: 10 }) {
  const rng = mulberry32(seed), out = [];
  for (let i = 0; i < n; i++) out.push({ date: null, numeros: drawNumbers(rng, r.main, r.mainMax), numeroChance: drawChance(rng, r.chanceMax) });
  return out;
}
