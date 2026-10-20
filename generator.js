// Génération de grilles (exploration, sans effet sur les chances de gain).
import { drawNumbers, drawChance } from './rng.js';
import { frequencies, sumOf } from './stats.js';
/** opts: mode(random|frequent|rare|repartition|manual), include[], exclude[], count, draws[], rng, minEven, maxEven, minSum, maxSum, poolSize */
export function validateOpts(o) {
  const e = [];
  const inc = o.include || [], exc = o.exclude || [];
  if (!Number.isInteger(o.count) || o.count < 1 || o.count > 100) e.push('Le nombre de grilles doit être compris entre 1 et 100.');
  if ([...inc, ...exc].some((n) => !Number.isInteger(n) || n < 1 || n > 49)) e.push('Les numéros inclus/exclus doivent être compris entre 1 et 49.');
  if (inc.length > 5) e.push('Au plus 5 numéros obligatoires.');
  if (inc.some((n) => exc.includes(n))) e.push('Un numéro ne peut pas être à la fois inclus et exclu.');
  if (49 - new Set(exc).size < 5) e.push('Trop de numéros exclus : il en reste moins de 5.');
  if (['frequent', 'rare'].includes(o.mode) && !(o.draws && o.draws.length)) e.push('Ce mode nécessite un historique chargé.');
  if (o.minEven > o.maxEven) e.push('Minimum de pairs supérieur au maximum.');
  return e;
}
function pool(o) {
  let p = Array.from({ length: 49 }, (_, i) => i + 1).filter((n) => !(o.exclude || []).includes(n));
  if (o.mode === 'frequent' || o.mode === 'rare') {
    const f = frequencies(o.draws);
    p.sort((a, b) => (o.mode === 'frequent' ? f[b] - f[a] : f[a] - f[b]) || a - b);
    p = p.slice(0, Math.max(10, o.poolSize || 15));
  }
  return p;
}
export function generateGrids(o) {
  const errs = validateOpts(o); if (errs.length) throw new Error(errs.join(' '));
  const base = pool(o), inc = [...new Set(o.include || [])];
  const full = [...new Set([...base, ...inc])];
  const grids = [];
  for (let g = 0; g < o.count; g++) {
    let nums = null;
    for (let t = 0; t < 20000 && !nums; t++) {
      const rest = full.filter((n) => !inc.includes(n));
      const pick = drawNumbers(o.rng, 5 - inc.length, rest.length).map((i) => rest[i - 1]);
      const c = [...inc, ...pick].sort((a, b) => a - b);
      const ev = c.filter((x) => x % 2 === 0).length, s = sumOf({ numeros: c });
      if (o.mode === 'repartition' && (ev < (o.minEven ?? 0) || ev > (o.maxEven ?? 5) || s < (o.minSum ?? 15) || s > (o.maxSum ?? 235))) continue;
      nums = c;
    }
    if (!nums) throw new Error('Contraintes impossibles à satisfaire (20 000 essais).');
    grids.push({ numeros: nums, numeroChance: drawChance(o.rng), mode: o.mode, somme: sumOf({ numeros: nums }), pairs: nums.filter((x) => x % 2 === 0).length });
  }
  return grids;
}
