import test from 'node:test'; import assert from 'node:assert/strict';
import { validateDraw, validateDataset, parseCsv, parseJson, parseFileText, toCsv, normDate } from '../js/data.js';
import { simulate, mulberry32, drawNumbers } from '../js/rng.js';
import * as S from '../js/stats.js';
import { generateGrids, validateOpts } from '../js/generator.js';
import { chiSquareGof } from '../js/maths.js';
const ok = { date: '2020-01-04', numeros: [4, 17, 23, 36, 44], numeroChance: 8 };
test('tirage valide', () => assert.equal(validateDraw(ok).errors.length, 0));
test('rejets', () => {
  const bad = (o) => validateDraw({ ...ok, ...o }).errors.length > 0;
  assert.ok(bad({ numeros: [4, 4, 23, 36, 44] })); assert.ok(bad({ numeros: [0, 17, 23, 36, 50] })); assert.ok(bad({ date: '2020-02-31' }));
  assert.ok(bad({ numeroChance: 11 })); assert.ok(bad({ numeroChance: undefined })); assert.ok(bad({ numeros: undefined })); assert.ok(bad({ numeros: [1, 2, 3] })); assert.ok(bad({ date: '2005-01-01' }));
});
test('jeu : vide, mal formé, doublons, tri', () => {
  assert.ok(validateDataset([]).errors.length); assert.ok(parseJson('{oops').error); assert.ok(validateDataset(null).errors.length);
  assert.ok(validateDataset([ok, ok]).errors.some((e) => e.includes('double')));
  const r = validateDataset([{ ...ok, date: '2021-01-02' }, ok]); assert.equal(r.errors.length, 0); assert.equal(r.draws[0].date, '2020-01-04');
});
test('CSV aller-retour et dates FR', () => {
  assert.equal(normDate('04/01/2020'), '2020-01-04');
  const rows = parseCsv(toCsv([ok])).rows; assert.equal(validateDataset(rows).draws[0].numeroChance, 8);
  assert.ok(parseFileText('x.csv', 'a'.repeat(6e6)).error);
});
test('simulation : validité et reproductibilité', () => {
  const a = simulate(2000, 42), b = simulate(2000, 42), c = simulate(2000, 43);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  for (const d of a) { assert.equal(d.numeros.length, 5); assert.equal(new Set(d.numeros).size, 5); assert.ok(d.numeros.every((n) => n >= 1 && n <= 49)); assert.ok(d.numeroChance >= 1 && d.numeroChance <= 10); }
});
test('uniformité : khi-deux sur 20 000 tirages simulés (graine fixe)', () => {
  const f = S.frequencies(simulate(20000, 12345)).slice(1); const e = Array(49).fill((20000 * 5) / 49);
  const r = chiSquareGof(f, e); assert.ok(r.applicable); assert.ok(r.p > 0.001, `p=${r.p}`);
});
test('statistiques', () => {
  const d = { numeros: [4, 17, 23, 36, 44] }; assert.equal(S.sumOf(d), 124); assert.deepEqual(S.gaps(d), [13, 6, 13, 8]);
  const th = S.parityTheory(); assert.ok(Math.abs(th.reduce((a, b) => a + b) - 1) < 1e-12);
  const ds = S.describe([1, 2, 3, 4]); assert.equal(ds.median, 2.5); assert.ok(Math.abs(ds.variance - 5 / 3) < 1e-12);
  const draws = validateDataset([ok, { ...ok, date: '2020-01-06', numeros: [1, 2, 3, 4, 5] }]).draws;
  assert.equal(S.delays(draws)[17].delay, 1); assert.equal(S.delays(draws)[1].delay, 0); assert.equal(S.pairCounts(draws).get(417), 1); assert.equal(S.tripletCounts(draws).size, 20);
});
test('générateur', () => {
  const rng = mulberry32(1);
  for (const g of generateGrids({ mode: 'random', count: 50, include: [7, 8], exclude: [1, 2, 3], rng })) { assert.equal(new Set(g.numeros).size, 5); assert.ok(g.numeros.includes(7) && g.numeros.includes(8)); assert.ok(![1, 2, 3].some((x) => g.numeros.includes(x))); }
  assert.ok(validateOpts({ mode: 'frequent', count: 1, draws: [] }).length); assert.ok(validateOpts({ mode: 'random', count: 1, include: [1], exclude: [1] }).length);
  const gs = generateGrids({ mode: 'repartition', count: 20, minEven: 2, maxEven: 3, minSum: 100, maxSum: 150, rng }); assert.ok(gs.every((g) => g.pairs >= 2 && g.pairs <= 3 && g.somme >= 100 && g.somme <= 150));
  assert.throws(() => generateGrids({ mode: 'repartition', count: 1, minSum: 230, maxSum: 235, minEven: 5, maxEven: 5, rng }));
});
