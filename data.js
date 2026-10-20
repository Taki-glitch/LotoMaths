// Modèle de données, import (CSV/JSON) et validation.
import { regimeFor } from './maths.js';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export function normDate(s) {
  s = String(s ?? '').trim();
  const m = s.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/);
  if (m) s = `${m[3]}-${m[2]}-${m[1]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s ? s : null;
}
/** Valide un tirage ; retourne {draw, errors}. */
export function validateDraw(raw, label = 'Tirage') {
  const errors = [];
  if (!raw || typeof raw !== 'object') return { draw: null, errors: [`${label} : enregistrement invalide.`] };
  const date = normDate(raw.date);
  if (!date) errors.push(`${label} : date invalide (« ${raw.date ?? ''} »), format attendu AAAA-MM-JJ.`);
  const nums = raw.numeros, chance = raw.numeroChance;
  if (!Array.isArray(nums)) errors.push(`${label} : champ « numeros » manquant.`);
  const noChance = chance === undefined || chance === null || chance === '';
  if (noChance) errors.push(`${label} : numéro Chance manquant.`);
  const reg = date ? regimeFor(date) : null;
  if (date && !reg) errors.push(`${label} : la date ${date} est antérieure au premier régime pris en charge (5/49 + Chance, depuis le 2008-10-06) ; ce format n'est pas importé.`);
  if (Array.isArray(nums)) {
    const n = nums.map(Number);
    if (n.length !== 5) errors.push(`${label} : ${n.length} numéros au lieu de 5.`);
    if (n.some((x) => !Number.isInteger(x))) errors.push(`${label} : numéro non entier ou manquant.`);
    else {
      if (n.some((x) => x < 1 || x > 49)) errors.push(`${label} : numéro hors de la plage 1–49.`);
      if (new Set(n).size !== n.length) errors.push(`${label} : numéros en double.`);
    }
  }
  if (!noChance) { const c = Number(chance); if (!Number.isInteger(c) || c < 1 || c > 10) errors.push(`${label} : numéro Chance hors de la plage 1–10.`); }
  if (errors.length) return { draw: null, errors };
  return { draw: { date, numeros: nums.map(Number).sort((a, b) => a - b), numeroChance: Number(chance), regime: reg.id }, errors };
}
/** Valide un jeu complet. L'appelant ne doit pas remplacer ses données si errors n'est pas vide. */
export function validateDataset(rows) {
  const draws = [], errors = [], seen = new Set();
  if (!Array.isArray(rows)) return { draws, errors: ['Le fichier ne contient pas une liste de tirages.'] };
  if (rows.length === 0) return { draws, errors: ['Fichier vide : aucun tirage.'] };
  rows.forEach((r, i) => {
    const { draw, errors: e } = validateDraw(r, `Ligne ${i + 1}`);
    if (!draw) return errors.push(...e);
    if (seen.has(draw.date)) return errors.push(`Ligne ${i + 1} : tirage en double pour la date ${draw.date}.`);
    seen.add(draw.date); draws.push(draw);
  });
  draws.sort((a, b) => a.date.localeCompare(b.date));
  return { draws, errors };
}
export function parseJson(text) {
  try { const v = JSON.parse(text); return { rows: Array.isArray(v) ? v : v?.tirages, error: null }; }
  catch (e) { return { rows: null, error: 'JSON mal formé : ' + e.message }; }
}
/** CSV : date;n1;n2;n3;n4;n5;chance (séparateur ; , ou tabulation ; en-tête optionnel). */
export function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], error: null };
  const sep = [';', '\t', ','].find((s) => lines[0].includes(s)) || ';';
  const rows = [];
  lines.forEach((l, i) => { const c = l.split(sep).map((x) => x.trim()); if (i === 0 && !/^\d/.test(c[1] ?? '')) return; rows.push({ date: c[0], numeros: c.slice(1, 6), numeroChance: c[6] }); });
  return { rows, error: null };
}
export const toCsv = (draws) => 'date;n1;n2;n3;n4;n5;chance\n' + draws.map((d) => [d.date, ...d.numeros, d.numeroChance].join(';')).join('\n') + '\n';
export function parseFileText(name, text) {
  if (text.length > MAX_FILE_BYTES) return { rows: null, error: 'Fichier trop volumineux (5 Mo maximum).' };
  return /\.json$/i.test(name) ? parseJson(text) : parseCsv(text);
}
