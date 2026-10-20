import { REGIMES, comb, fmtBig, fmtNum, fmtPct, probOutcome, probSubset, probJackpotDistinct, chiSquareGof, wilson, zTestProportion, twoProportionZ, bonferroni, benjaminiHochberg } from './maths.js';
import { validateDataset, parseFileText, toCsv } from './data.js';
import * as S from './stats.js';
import { simulate, mulberry32, randomSeed, drawNumbers } from './rng.js';
import { generateGrids } from './generator.js';
import { barChart, lineChart, esc } from './charts.js';
import { $, toast, card, stat, balls, note, download, dataTable } from './ui.js';

const R = REGIMES[0], P1 = R.main / R.mainMax;
const state = { draws: [], source: null, loadError: null, updated: null };
const PAGES = [['dashboard', 'Tableau de bord'], ['historique', 'Historique des tirages'], ['numeros', 'Analyse des numéros'], ['probabilites', 'Probabilités'], ['combinaisons', 'Combinaisons et associations'], ['temporel', 'Analyse temporelle'], ['simulation', 'Simulations'], ['labo', 'Laboratoire statistique'], ['generateur', 'Générateur de grilles'], ['import', 'Importation et qualité'], ['docs', 'Paramètres et documentation']];
const pref = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('lm.' + k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('lm.' + k, JSON.stringify(v)); } catch {} } };
const warnNoData = () => card('', `<div class="empty"><p><b>Aucun historique de tirages n'est chargé.</b></p><p>Aucune donnée officielle n'est fournie avec ce projet. Importez un fichier CSV/JSON dans la page <a href="#import">Importation</a>, ou placez-le dans <code>data/tirages.json</code>.</p></div>`);
const PERIODS = [['all', 'Historique complet'], ['50', '50 derniers'], ['100', '100 derniers'], ['500', '500 derniers']];
const byPeriod = (v) => (v === 'all' ? state.draws : S.filterDraws(state.draws, { last: +v }));
const periodSel = (id, v) => `<label>Période<select id="${id}">${PERIODS.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
const CAVEAT = note('Observation historique : ces résultats décrivent le passé. Ils ne rendent aucun numéro plus ou moins probable au prochain tirage.');

// ---------- Chargement ----------
async function load() {
  try {
    const res = await fetch(new URL('data/tirages.json', document.baseURI), { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const v = validateDataset(await res.json().then((j) => (Array.isArray(j) ? j : j.tirages)));
    if (v.errors.length && !v.draws.length) { if (!(v.errors.length === 1 && v.errors[0].startsWith('Fichier vide'))) state.loadError = 'Fichier de données invalide : ' + v.errors[0]; }
    else if (v.errors.length) state.loadError = `Fichier de données invalide (${v.errors.length} erreurs) : ${v.errors[0]}`;
    else { state.draws = v.draws; state.source = 'data/tirages.json'; }
  } catch (e) { state.loadError = 'Impossible de charger data/tirages.json : ' + e.message; }
}
const rangeText = () => (state.draws.length ? `${state.draws[0].date} → ${state.draws.at(-1).date}` : '—');

// ---------- Pages ----------
const pages = {};
pages.dashboard = (el) => {
  if (!state.draws.length) return (el.innerHTML = (state.loadError ? note(esc(state.loadError), 'er') : '') + warnNoData());
  const per = pref.get('dashPeriod', 'all'), d = byPeriod(per), N = d.length, sums = d.map(S.sumOf), ds = S.describe(sums), f = S.frequencies(d), last = state.draws.at(-1);
  const age = Math.floor((Date.now() - new Date(last.date)) / 864e5);
  const dist = S.sumDistribution(d), keys = Object.keys(dist).map(Number).sort((a, b) => a - b), pc = S.parityCounts(d), pt = S.parityTheory();
  const win = Math.min(50, N), ma = sums.map((_, i) => (i + 1 < win ? null : sums.slice(i + 1 - win, i + 1).reduce((a, b) => a + b) / win)).filter((x) => x !== null);
  const distinct = new Set(d.map((x) => x.numeros.join('-'))).size;
  el.innerHTML = `<div class="row">${periodSel('per', per)}</div>` + (age > 14 ? note(`Données potentiellement non à jour : dernier tirage le ${last.date} (il y a ${age} jours).`, 'er') : '') +
    `<div class="grid">${stat('Tirages analysés', N.toLocaleString('fr-FR'))}${stat('Période', rangeText())}${stat('Moyenne des sommes', fmtNum(ds.mean, 2))}${stat('Médiane des sommes', fmtNum(ds.median, 1))}${stat('Écart-type des sommes', fmtNum(ds.sd, 2))}${stat('Apparitions moyennes / numéro', fmtNum((N * 5) / 49, 2))}${stat('Combinaisons distinctes', distinct.toLocaleString('fr-FR'))}${stat('Statut des données', 'Validées')}</div>` +
    card('Dernier tirage disponible', `<p>${last.date}</p>${balls(last.numeros, last.numeroChance)}<p class="mu">Source : ${esc(state.source)}. Mise à jour du fichier : ${esc(state.updated || 'non renseignée')}.</p>`) +
    '<div class="cols">' +
    card('Fréquence des numéros (trait : espérance théorique)', barChart({ labels: f.slice(1).map((_, i) => i + 1), values: f.slice(1), ref: N * P1, title: 'Fréquences observées par numéro', desc: `Espérance théorique ${fmtNum(N * P1, 1)} apparitions.`, step: 2 })) +
    card('Distribution des sommes', barChart({ labels: keys, values: keys.map((k) => dist[k]), title: 'Distribution des sommes', desc: `Moyenne ${fmtNum(ds.mean, 1)}, théorique 125.`, step: Math.ceil(keys.length / 12) })) +
    card('Pairs / impairs (trait : théorie hypergéométrique)', barChart({ labels: ['0 pair', '1', '2', '3', '4', '5'], values: pc.map((x) => x / N), ref: pt, title: 'Nombre de pairs par tirage', fmt: (v) => fmtPct(v, 1) })) +
    card(`Moyenne mobile des sommes (${win} tirages, pointillé = 125 théorique)`, ma.length > 1 ? lineChart({ labels: d.slice(win - 1).map((x) => x.date), series: [{ name: 'Moyenne mobile', values: ma }, { name: 'Théorique', values: ma.map(() => 125) }], title: 'Évolution de la moyenne des sommes', fmt: (v) => fmtNum(v, 0) }) : '<p class="empty">Pas assez de tirages.</p>') +
    '</div>' + CAVEAT;
  $('#per').onchange = (e) => { pref.set('dashPeriod', e.target.value); pages.dashboard(el); };
};

pages.historique = (el) => {
  if (!state.draws.length) return (el.innerHTML = warnNoData());
  const st = pref.get('hist', { from: '', to: '', q: '', dir: 'desc' });
  el.innerHTML = card('Filtres', `<div class="row"><label>Du<input type="date" id="f" value="${st.from}"></label><label>Au<input type="date" id="t" value="${st.to}"></label><label>Recherche de date<input id="q" placeholder="2020-01" value="${esc(st.q)}"></label><button class="btn" id="ex">Exporter CSV filtré</button></div><div id="cnt" class="mu"></div><div id="tb"></div>`) +
    card('Rechercher une combinaison', `<div class="row"><label>5 numéros (séparés par espace)<input id="cn" placeholder="4 17 23 36 44"></label><label>Chance (optionnel)<input id="cc" type="number" min="1" max="10"></label><button class="btn pri" id="cs">Rechercher</button></div><div id="cr"></div>`);
  let rows = [];
  const upd = () => {
    st.from = $('#f').value; st.to = $('#t').value; st.q = $('#q').value.trim(); pref.set('hist', st);
    rows = S.filterDraws(state.draws, { from: st.from, to: st.to }).filter((d) => !st.q || d.date.includes(st.q)).map((d) => ({ ...d, nums: d.numeros.join(' – '), somme: S.sumOf(d) }));
    $('#cnt').textContent = `${rows.length.toLocaleString('fr-FR')} tirage(s) correspondant(s).`;
    dataTable($('#tb'), [{ k: 'date', label: 'Date' }, { k: 'nums', label: 'Numéros', html: (r) => balls(r.numeros) }, { k: 'numeroChance', label: 'Chance' }, { k: 'somme', label: 'Somme' }], rows, { sortKey: 'date', dir: 'desc', pageSize: 25, caption: 'Tirages' });
  };
  ['f', 't', 'q'].forEach((i) => ($('#' + i).oninput = upd)); upd();
  $('#ex').onclick = () => { if (!rows.length) return toast('Aucun tirage à exporter.', true); download(`lotomaths-tirages_${st.from || 'debut'}_${st.to || 'fin'}.csv`, toCsv(rows), 'text/csv'); toast('Export CSV généré.'); };
  $('#cs').onclick = () => {
    const nums = $('#cn').value.trim().split(/[\s,;]+/).map(Number), ch = $('#cc').value ? +$('#cc').value : null;
    if (nums.length !== 5 || nums.some((n) => !Number.isInteger(n) || n < 1 || n > 49) || new Set(nums).size !== 5) return ($('#cr').innerHTML = note('Saisissez 5 numéros distincts entre 1 et 49.', 'er'));
    const set = (d) => d.numeros.filter((x) => nums.includes(x)).length;
    const ex = state.draws.filter((d) => set(d) === 5), exC = ch ? ex.filter((d) => d.numeroChance === ch) : [];
    const cnt = [0, 0, 0, 0, 0, 0]; state.draws.forEach((d) => cnt[set(d)]++);
    $('#cr').innerHTML = `<p><b>Combinaison exacte (5 numéros${ch ? ' + Chance ' + ch : ''}) :</b> ${ch ? exC.length : ex.length} tirage(s)${ch ? ` — 5 numéros identiques toutes Chance confondues : ${ex.length}` : ''}.</p>${ex.map((d) => `<p>${d.date} ${balls(d.numeros, d.numeroChance)}</p>`).join('')}<p>Tirages ayant exactement <i>k</i> numéros en commun : ${cnt.map((c, k) => `${k} → ${c}`).join(' ; ')}.</p>${note(`Sur ${state.draws.length} tirages, ${fmtNum(state.draws.length / 1906884, 4)} apparition(s) attendue(s) en moyenne pour une combinaison de 5 numéros : l'absence ou la présence est sans conséquence prédictive.`)}`;
  };
};

pages.numeros = (el) => {
  if (!state.draws.length) return (el.innerHTML = warnNoData());
  const per = pref.get('numPeriod', 'all'), d = byPeriod(per), N = d.length, f = S.frequencies(d), dl = S.delays(d);
  const rows = f.map((c, n) => n && ({ n, c, freq: c / N, theo: P1, diff: c / N - P1, rel: (c / N - P1) / P1, lo: wilson(c, N)[0], hi: wilson(c, N)[1], last: dl[n].lastDate, delay: dl[n].delay })).filter(Boolean);
  const cf = S.chanceFrequencies(d);
  const sorted = [...rows].sort((a, b) => b.c - a.c);
  el.innerHTML = `<div class="row">${periodSel('per', per)}</div>` + card('Fréquences par numéro', `<p class="mu">Fréquence théorique = 5/49 = ${fmtPct(P1, 4)}. Intervalle de Wilson à 95 % sur la fréquence observée. N = ${N.toLocaleString('fr-FR')} tirages.</p><div id="tb"></div>`) +
    `<div class="cols">${card('Histogramme des fréquences', barChart({ labels: rows.map((r) => r.n), values: rows.map((r) => r.c), ref: N * P1, title: 'Apparitions par numéro', step: 2 }))}${card('Écart à la fréquence théorique', barChart({ labels: rows.map((r) => r.n), values: rows.map((r) => Math.abs(r.diff)), title: 'Écart absolu à 5/49 (valeur absolue)', desc: 'Les écarts sont représentés en valeur absolue.', fmt: (v) => fmtPct(v, 2), step: 2 }))}${card('Numéro Chance (théorie 1/10)', barChart({ labels: cf.slice(1).map((_, i) => i + 1), values: cf.slice(1), ref: N / 10, title: 'Apparitions du numéro Chance' }))}</div>` +
    card('Extrêmes observés', `<p>Plus fréquents : ${sorted.slice(0, 5).map((r) => `${r.n} (${r.c})`).join(', ')}. Moins fréquents : ${sorted.slice(-5).reverse().map((r) => `${r.n} (${r.c})`).join(', ')}.</p>${note('Parmi 49 numéros, il existe toujours un numéro en tête et un en queue de classement : ces extrêmes sont attendus sous un hasard parfait.')}`) + CAVEAT;
  dataTable($('#tb'), [{ k: 'n', label: 'N°' }, { k: 'c', label: 'Apparitions' }, { k: 'freq', label: 'Fréq. obs.', fmt: (v) => fmtPct(v, 2) }, { k: 'theo', label: 'Fréq. théo.', fmt: (v) => fmtPct(v, 2) }, { k: 'diff', label: 'Écart', fmt: (v) => fmtPct(v, 2) }, { k: 'rel', label: 'Écart rel.', fmt: (v) => fmtPct(v, 1) }, { k: 'lo', label: 'IC bas', fmt: (v) => fmtPct(v, 2) }, { k: 'hi', label: 'IC haut', fmt: (v) => fmtPct(v, 2) }, { k: 'last', label: 'Dernière app.' }, { k: 'delay', label: 'Tirages depuis' }], rows, { sortKey: 'n', dir: 'asc', caption: 'Table triable' });
  $('#per').onchange = (e) => { pref.set('numPeriod', e.target.value); pages.numeros(el); };
};

pages.probabilites = (el) => {
  const rows = []; for (let k = 5; k >= 0; k--) for (const c of [true, false]) rows.push({ k, c, ...probOutcome(k, c) });
  el.innerHTML = card('Régime des règles', `<p>${esc(R.label)} (depuis le ${R.from}). Seul ce régime est pris en charge ; les calculs sont faits par le programme à partir de ses paramètres.</p><p>Nombre de combinaisons de numéros : <b>C(49,5) = ${fmtBig(comb(49, 5))}</b>. Avec le numéro Chance : ${fmtBig(comb(49, 5) * 10n)}.</p>`) +
    card('Calculateur', `<div class="row"><label>Bons numéros<select id="k">${[5, 4, 3, 2, 1, 0].map((k) => `<option>${k}</option>`).join('')}</select></label><label>Numéro Chance<select id="c"><option value="1">Bon</option><option value="0">Mauvais</option></select></label></div><div id="out"></div>`) +
    card('Toutes les issues possibles', `<div class="tw"><table><thead><tr><th>Bons numéros</th><th>Chance</th><th>Cas favorables</th><th>Probabilité</th><th>1 chance sur…</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.k}</td><td>${r.c ? 'bon' : 'mauvais'}</td><td>${fmtBig(r.fav)}</td><td>${fmtPct(r.p, 6)}</td><td>${fmtNum(1 / r.p, 1)}</td></tr>`).join('')}</tbody></table></div>${note("Probabilité de gagner et montant du gain sont deux notions distinctes. La grille officielle des rangs et des gains n'est pas intégrée : elle n'a pas pu être vérifiée dans cet environnement.")}`) +
    card('Plusieurs grilles distinctes (jackpot)', `<div class="row"><label>Nombre de grilles distinctes<input id="g" type="number" min="1" value="10"></label></div><div id="go"></div><p class="mu">Des grilles distinctes visent des issues disjointes : les probabilités s'additionnent. Des grilles identiques n'augmentent pas la probabilité.</p>`) +
    card('Calculateur C(n,k)', `<div class="row"><label>n<input id="n" type="number" min="0" value="49"></label><label>k<input id="kk" type="number" min="0" value="5"></label></div><div id="co"></div>`) +
    card('Sous-ensembles', `<p>Une paire précise apparaît avec P = C(47,3)/C(49,5) = ${fmtPct(probSubset(2), 4)} (= 5/588). Un triplet précis : C(46,2)/C(49,5) = ${fmtPct(probSubset(3), 5)}. Nombre de triplets possibles : C(49,3) = ${fmtBig(comb(49, 3))}.</p>`);
  const up = () => { const k = +$('#k').value, c = $('#c').value === '1', o = probOutcome(k, c); $('#out').innerHTML = `<p>Cas favorables : <b>${fmtBig(o.fav)}</b> / ${fmtBig(o.total)} possibles → P = <b>${fmtPct(o.p, 8)}</b> (1 sur ${fmtNum(1 / o.p, 1)}).</p><p class="mu">Formule : C(5,${k})·C(44,${5 - k}) × ${c ? '1' : '9'} / (C(49,5) × 10).</p>`; };
  $('#k').onchange = $('#c').onchange = up; up();
  const ug = () => { const g = Math.floor(+$('#g').value); $('#go').innerHTML = g >= 1 ? `<p>${g} grille(s) distincte(s) : P(jackpot) = ${fmtPct(probJackpotDistinct(g), 8)}.</p>` : note('Entrez un entier ≥ 1.', 'er'); }; $('#g').oninput = ug; ug();
  const uc = () => { const n = +$('#n').value, k = +$('#kk').value; $('#co').innerHTML = Number.isInteger(n) && Number.isInteger(k) && n >= 0 && n <= 5000 && k >= 0 ? `<p>C(${n},${k}) = <b>${esc(fmtBig(comb(n, k)))}</b></p>` : note('Entiers positifs requis (n ≤ 5000).', 'er'); }; $('#n').oninput = $('#kk').oninput = uc; uc();
};

pages.combinaisons = (el) => {
  if (!state.draws.length) return (el.innerHTML = warnNoData());
  const per = pref.get('combPeriod', 'all'), d = byPeriod(per), N = d.length, pp = probSubset(2);
  const pm_ = S.pairCounts(d), all = [...pm_.entries()].map(([k, c]) => ({ a: Math.floor(k / 100), b: k % 100, c })), nTests = 1176;
  const ps = []; for (let a = 1; a <= 49; a++) for (let b = a + 1; b <= 49; b++) ps.push({ a, b, c: pm_.get(a * 100 + b) || 0 });
  const raw = ps.map((x) => zTestProportion(x.c, N, pp).p), bo = bonferroni(raw), bh = benjaminiHochberg(raw);
  ps.forEach((x, i) => Object.assign(x, { exp: N * pp, label: `${x.a}-${x.b}`, p: raw[i], bonf: bo[i], bh: bh[i] }));
  const tri = [...S.tripletCounts(d).entries()].map(([k, c]) => ({ t: `${Math.floor(k / 10000)}-${Math.floor(k / 100) % 100}-${k % 100}`, c })).sort((a, b) => b.c - a.c).slice(0, 20);
  el.innerHTML = `<div class="row">${periodSel('per', per)}</div>` + card('Paires (1 176 tests)', `<p class="mu">Fréquence théorique d'une paire par tirage : 5/588 = ${fmtPct(pp, 4)}. Effectif attendu : ${fmtNum(N * pp, 2)}. p-valeurs : approximation normale (peu fiable si l'effectif attendu < 5). Corrections : Bonferroni et Benjamini-Hochberg sur ${nTests} tests.</p><div id="tb"></div>${note(`Avec ${nTests} paires testées, quelques p-valeurs < 5 % non corrigées sont attendues par pur hasard (environ ${Math.round(nTests * 0.05)}). Seules les colonnes corrigées sont à considérer.`)}`) +
    card('Consulter une paire', `<div class="row"><label>N° 1<input id="p1" type="number" min="1" max="49" value="7"></label><label>N° 2<input id="p2" type="number" min="1" max="49" value="14"></label></div><div id="po"></div>`) +
    card('Triplets les plus fréquents (descriptif, aucun test)', `<p class="mu">${fmtBig(comb(49, 3))} triplets possibles ; attendu par triplet : ${fmtNum(N * probSubset(3), 3)}.</p><p>${tri.map((t) => `${t.t} (${t.c})`).join(' · ') || '—'}</p>`) + CAVEAT;
  dataTable($('#tb'), [{ k: 'label', label: 'Paire' }, { k: 'c', label: 'Observé' }, { k: 'exp', label: 'Attendu', fmt: (v) => fmtNum(v, 2) }, { k: 'p', label: 'p brute', fmt: (v) => fmtNum(v, 4) }, { k: 'bonf', label: 'p Bonferroni', fmt: (v) => fmtNum(v, 4) }, { k: 'bh', label: 'q B-H', fmt: (v) => fmtNum(v, 4) }], ps, { sortKey: 'c', dir: 'desc', pageSize: 15, caption: 'Paires' });
  const look = () => { let a = +$('#p1').value, b = +$('#p2').value; if (a > b) [a, b] = [b, a]; if (!(a >= 1 && b <= 49 && a !== b)) return ($('#po').innerHTML = note('Deux numéros distincts entre 1 et 49.', 'er')); const ds = d.filter((x) => x.numeros.includes(a) && x.numeros.includes(b)); $('#po').innerHTML = `<p>Paire ${a}-${b} : ${ds.length} tirage(s) sur ${N} (${fmtPct(ds.length / N, 3)} ; théorie ${fmtPct(pp, 3)}).</p><p class="mu">${ds.slice(-10).map((x) => x.date).join(', ') || 'aucun'}${ds.length > 10 ? ' (10 derniers)' : ''}</p>`; };
  $('#p1').oninput = $('#p2').oninput = look; look();
  $('#per').onchange = (e) => { pref.set('combPeriod', e.target.value); pages.combinaisons(el); };
};

pages.temporel = (el) => {
  if (!state.draws.length) return (el.innerHTML = warnNoData());
  const st = pref.get('temp', { per: 'all', y: '', from: '', to: '' }), years = [...new Set(state.draws.map((d) => d.date.slice(0, 4)))];
  el.innerHTML = card('Période', `<div class="row">${periodSel('per', st.per)}<label>Année<select id="y"><option value="">—</option>${years.map((y) => `<option ${y === st.y ? 'selected' : ''}>${y}</option>`).join('')}</select></label><label>Du<input type="date" id="f" value="${st.from}"></label><label>Au<input type="date" id="t" value="${st.to}"></label></div><p class="mu" id="pi"></p>`) +
    card('Retards', `<p class="mu">Convention : retard = nombre de tirages écoulés depuis la dernière apparition (0 si présent au dernier tirage). Sous indépendance, l'attente moyenne entre deux apparitions est 1/p = ${fmtNum(1 / P1, 2)} tirages et P(absent pendant k tirages) = (1 − p)^k.</p><div id="tb"></div>${note("Un grand retard ne rend pas le numéro plus probable au prochain tirage : les tirages sont indépendants.")}`) +
    card('Comparer deux périodes', `<div class="row"><label>A : du<input type="date" id="a1"></label><label>au<input type="date" id="a2"></label><label>B : du<input type="date" id="b1"></label><label>au<input type="date" id="b2"></label><button class="btn pri" id="cmp">Comparer</button></div><div id="cr"></div>`);
  const cur = () => (st.from || st.to ? S.filterDraws(state.draws, st) : st.y ? S.filterDraws(state.draws, { from: st.y + '-01-01', to: st.y + '-12-31' }) : byPeriod(st.per));
  const upd = () => {
    st.per = $('#per').value; st.y = $('#y').value; st.from = $('#f').value; st.to = $('#t').value; pref.set('temp', st);
    const d = cur(), req = +st.per; $('#pi').textContent = `${d.length} tirage(s) analysé(s)` + (!st.y && !st.from && !st.to && req && d.length < req ? ` (moins que les ${req} demandés : données disponibles utilisées)` : '');
    const dl = S.delays(d).filter(Boolean).map((x) => ({ ...x, pk: d.length && x.delay !== null ? Math.pow(1 - P1, x.delay) : null, mean: 1 / P1 }));
    dataTable($('#tb'), [{ k: 'n', label: 'N°' }, { k: 'lastDate', label: 'Dernière app.' }, { k: 'delay', label: 'Retard' }, { k: 'mean', label: 'Attente moy. théo.', fmt: (v) => fmtNum(v, 2) }, { k: 'pk', label: 'P(retard ≥ obs.) = (1−p)^k', fmt: (v) => fmtNum(v, 4) }], dl, { sortKey: 'delay', dir: 'desc', caption: 'Retards' });
  };
  ['per', 'y', 'f', 't'].forEach((i) => ($('#' + i).oninput = upd)); upd();
  $('#cmp').onclick = () => {
    const A = S.filterDraws(state.draws, { from: $('#a1').value, to: $('#a2').value }), B = S.filterDraws(state.draws, { from: $('#b1').value, to: $('#b2').value });
    if (A.length < 30 || B.length < 30) return ($('#cr').innerHTML = note('Chaque période doit contenir au moins 30 tirages.', 'er'));
    const fa = S.frequencies(A), fb = S.frequencies(B), ps = []; for (let n = 1; n <= 49; n++) ps.push(twoProportionZ(fa[n], A.length, fb[n], B.length).p);
    const q = benjaminiHochberg(ps), sig = q.filter((x) => x < 0.05).length, raw = ps.filter((x) => x < 0.05).length, sa = S.describe(A.map(S.sumOf)), sb = S.describe(B.map(S.sumOf));
    $('#cr').innerHTML = `<p>A : ${A.length} tirages, B : ${B.length}. Somme moyenne : ${fmtNum(sa.mean, 2)} vs ${fmtNum(sb.mean, 2)}. Pairs (moy.) : ${fmtNum(S.parityCounts(A).reduce((s, c, k) => s + c * k, 0) / A.length, 2)} vs ${fmtNum(S.parityCounts(B).reduce((s, c, k) => s + c * k, 0) / B.length, 2)}.</p><p>Différences de fréquence par numéro (test z à deux proportions, 49 tests) : ${raw} p < 5 % avant correction (≈ ${Math.round(49 * 0.05)} attendues par hasard) ; ${sig} après Benjamini-Hochberg.</p>${note(sig === 0 ? 'Les différences observées sont compatibles avec les fluctuations aléatoires.' : 'Des écarts persistent après correction ; ils nécessitent des données supplémentaires avant toute conclusion.')}`;
  };
};

pages.simulation = (el) => {
  const st = pref.get('sim', { n: 10000, seed: 12345 });
  el.innerHTML = card('Paramètres', `<div class="row"><label>Tirages<select id="pre"><option>1</option><option>100</option><option>1000</option><option>10000</option><option value="">Personnalisé</option></select></label><label>Nombre<input id="n" type="number" min="1" max="500000" value="${st.n}"></label><label>Graine (reproductibilité)<input id="s" type="number" min="0" value="${st.seed}"></label><button class="btn" id="rs">Graine aléatoire</button><button class="btn pri" id="go">Simuler</button><button class="btn" id="cx" disabled>Annuler</button></div><p class="mu">Générateur mulberry32 (pseudo-aléatoire reproductible, non cryptographique) ; sélection uniforme sans remise (Fisher-Yates partiel). Calcul par lots avec progression.</p><progress id="pr" max="100" value="0" hidden></progress><div id="out"></div>`);
  let cancel = false;
  $('#pre').onchange = (e) => e.target.value && ($('#n').value = e.target.value);
  $('#rs').onclick = () => ($('#s').value = randomSeed());
  $('#cx').onclick = () => (cancel = true);
  $('#go').onclick = async () => {
    const n = +$('#n').value, seed = +$('#s').value;
    if (!Number.isInteger(n) || n < 1 || n > 500000 || !Number.isInteger(seed) || seed < 0) return toast('Nombre (1–500 000) et graine (entier ≥ 0) requis.', true);
    st.n = n; st.seed = seed; pref.set('sim', st); cancel = false; $('#go').disabled = true; $('#cx').disabled = false; $('#pr').hidden = false;
    const rng = mulberry32(seed), draws = [];
    for (let i = 0; i < n && !cancel; i += 5000) { for (let j = i; j < Math.min(n, i + 5000); j++) draws.push({ numeros: drawNumbers(rng), numeroChance: 1 + Math.floor(rng() * 10) }); $('#pr').value = (100 * draws.length) / n; await new Promise((r) => setTimeout(r)); }
    $('#go').disabled = false; $('#cx').disabled = true; $('#pr').hidden = true;
    if (cancel) return toast('Simulation annulée.', true);
    const f = S.frequencies(draws), ds = S.describe(draws.map(S.sumOf)), pc = S.parityCounts(draws), pt = S.parityTheory(), chi = chiSquareGof(f.slice(1), Array(49).fill(n * P1)), H = state.draws.length ? S.frequencies(state.draws) : null;
    $('#out').innerHTML = `<div class="grid">${stat('Tirages simulés', n.toLocaleString('fr-FR'))}${stat('Somme moyenne (théo. 125)', fmtNum(ds.mean, 2))}${stat('Écart-type des sommes', fmtNum(ds.sd, 2))}${stat('Khi² uniformité (p)', chi.applicable ? fmtNum(chi.p, 4) : 'n.a.')}</div><div class="cols">${card('Fréquences simulées (trait : théorie)', barChart({ labels: f.slice(1).map((_, i) => i + 1), values: f.slice(1), ref: n * P1, title: 'Fréquences simulées', step: 2 }))}${card('Pairs/impairs (trait : théorie)', barChart({ labels: ['0', '1', '2', '3', '4', '5'], values: pc.map((x) => x / n), ref: pt, title: 'Pairs simulés', fmt: (v) => fmtPct(v, 1) }))}</div>` +
      (H ? card('Simulation vs historique', `<p>Fréquence max. simulée ${fmtPct(Math.max(...f.slice(1)) / n, 2)} ; historique ${fmtPct(Math.max(...H.slice(1)) / state.draws.length, 2)} ; théorique ${fmtPct(P1, 2)}. Incertitude (écart-type binomial) sur une fréquence : ±${fmtPct(Math.sqrt(P1 * (1 - P1) / n), 2)} (simulation), ±${fmtPct(Math.sqrt(P1 * (1 - P1) / state.draws.length), 2)} (historique).</p>`) : note("Aucun historique chargé : comparaison simulation/historique indisponible.")) + note('Une simulation illustre le hasard ; elle ne démontre pas qu\'une stratégie améliore les chances de gain.') + `<button class="btn" id="exp">Exporter les fréquences (CSV)</button>`;
    $('#exp').onclick = () => download(`lotomaths-simulation_n${n}_graine${seed}.csv`, 'numero;apparitions\n' + f.slice(1).map((c, i) => `${i + 1};${c}`).join('\n') + '\n', 'text/csv');
    toast('Simulation terminée.');
  };
};

pages.labo = (el) => {
  if (!state.draws.length) return (el.innerHTML = warnNoData());
  const per = pref.get('labPeriod', 'all');
  el.innerHTML = `<div class="row">${periodSel('per', per)}<label>Simulations de référence<input id="B" type="number" min="100" max="5000" value="1000"></label><button class="btn pri" id="run">Lancer les tests</button></div><div id="out"></div>`;
  $('#per').onchange = (e) => pref.set('labPeriod', e.target.value);
  const block = (q, data, h, m, res, interp, lim) => card(q, `<p><b>Données :</b> ${data}</p><p><b>Hypothèses :</b> ${h}</p><p><b>Méthode :</b> ${m}</p><p><b>Résultat :</b> ${res}</p><p><b>Interprétation :</b> ${interp}</p><p class="mu"><b>Limites :</b> ${lim}</p>`);
  $('#run').onclick = async () => {
    const d = byPeriod($('#per').value), N = d.length, B = Math.min(5000, Math.max(100, +$('#B').value | 0)); pref.set('labPeriod', $('#per').value);
    const f = S.frequencies(d).slice(1), exp = Array(49).fill(N * P1), chi = chiSquareGof(f, exp);
    let html = '';
    html += chi.applicable ? block('Les fréquences des 49 numéros sont-elles compatibles avec l\'uniformité ?', `${N} tirages`, 'tirages indépendants, probabilité 5/49 par numéro, effectifs attendus ≥ 5', 'khi-deux d\'adéquation, 48 degrés de liberté', `χ² = ${fmtNum(chi.stat, 2)}, p = ${fmtNum(chi.p, 4)} (effectif attendu min. ${fmtNum(chi.minExpected, 1)})`, chi.p < 0.05 ? 'Écart significatif à 5 % : à confirmer, sans conclure à une manipulation.' : 'Aucun écart incompatible avec le hasard n\'est mis en évidence.', 'les 5 numéros d\'un tirage ne sont pas indépendants entre eux : le khi-deux est approximatif ; la p-valeur n\'est pas la probabilité que H0 soit vraie.')
      : block('Khi-deux d\'adéquation', `${N} tirages`, 'effectifs attendus ≥ 5', 'khi-deux', `<b>Non applicable</b> : effectif attendu ${fmtNum(chi.minExpected, 2)} < 5 (il faut au moins ${Math.ceil(5 / P1)} tirages).`, 'aucun test n\'est réalisé.', 'conditions d\'application non remplies.');
    // p-valeur empirique
    const rng = mulberry32(20240101); let ge = 0; const obs = chi.stat;
    for (let b = 0; b < B; b++) { const sf = Array(50).fill(0); for (let i = 0; i < N; i++) for (const x of drawNumbers(rng)) sf[x]++; const st = sf.slice(1).reduce((s, o) => s + (o - N * P1) ** 2 / (N * P1), 0); if (st >= obs) ge++; if (b % 50 === 0) await new Promise((r) => setTimeout(r)); }
    html += block('Même question, par simulation de référence', `statistique χ² observée = ${fmtNum(obs, 2)}`, 'tirages uniformes sans remise (modèle exact, sans approximation du khi-deux)', `${B} jeux simulés de ${N} tirages (graine fixe 20240101) ; p empirique = (1 + #{χ² simulé ≥ observé}) / (1 + ${B})`, `p = ${fmtNum((1 + ge) / (1 + B), 4)}`, 'plus fiable que le khi-deux ici, car il respecte la structure du tirage.', `précision limitée par B (±${fmtNum(1 / Math.sqrt(B), 3)} environ).`);
    // anomalies
    const rows = f.map((c, i) => ({ n: i + 1, c, p: zTestProportion(c, N, P1).p })); const bh = benjaminiHochberg(rows.map((r) => r.p)), bo = bonferroni(rows.map((r) => r.p)); rows.forEach((r, i) => Object.assign(r, { bh: bh[i], bo: bo[i] }));
    rows.sort((a, b) => a.p - b.p);
    html += card('Recherche d\'anomalies (5 écarts les plus marqués)', `<div class="tw"><table><thead><tr><th>N°</th><th>Obs. (att. ${fmtNum(N * P1, 1)})</th><th>p brute</th><th>Bonferroni</th><th>B-H</th><th>Statut</th></tr></thead><tbody>${rows.slice(0, 5).map((r) => `<tr><td>${r.n}</td><td>${r.c}</td><td>${fmtNum(r.p, 4)}</td><td>${fmtNum(r.bo, 4)}</td><td>${fmtNum(r.bh, 4)}</td><td>${r.bh < 0.05 ? 'robuste après correction (données supplémentaires nécessaires)' : r.p < 0.05 ? 'significatif non corrigé seulement' : 'écart descriptif'}</td></tr>`).join('')}</tbody></table></div>${note('49 tests ont été effectués : environ 2 p-valeurs < 5 % sont attendues par hasard. Un écart significatif n\'est jamais une preuve de manipulation.')}`);
    $('#out').innerHTML = html;
  };
};

pages.generateur = (el) => {
  const st = pref.get('gen', { mode: 'random', count: 5, include: '', exclude: '', per: 'all' });
  el.innerHTML = note('Les méthodes de génération proposées n’augmentent pas la probabilité mathématique de gagner dans un tirage équitable. Elles permettent uniquement d’explorer différentes façons de constituer une grille.', 'er') +
    card('Paramètres', `<div class="row"><label>Mode<select id="m"><option value="random">Aléatoire</option><option value="frequent">Numéros historiquement les plus fréquents</option><option value="rare">Numéros historiquement les moins fréquents</option><option value="repartition">Critères de répartition</option><option value="manual">Préférences manuelles (numéros imposés)</option></select></label><label>Grilles<input id="c" type="number" value="${st.count}" min="1" max="100"></label><label>Inclure<input id="i" value="${esc(st.include)}" placeholder="7 21"></label><label>Exclure<input id="x" value="${esc(st.exclude)}" placeholder="13"></label>${periodSel('per', st.per)}</div><div class="row" id="rep"><label>Pairs min<input id="e1" type="number" value="1" min="0" max="5"></label><label>Pairs max<input id="e2" type="number" value="4" min="0" max="5"></label><label>Somme min<input id="s1" type="number" value="100"></label><label>Somme max<input id="s2" type="number" value="150"></label></div><button class="btn pri" id="go">Générer</button> <button class="btn" id="ex">Exporter CSV</button><p class="mu">Le mode « associations historiques » n'est pas implémenté en V1.</p><div id="out"></div>`) +
    card('Comparateur de stratégies (expérimental, apprentissage → test)', `<div class="row"><label>Part d'apprentissage<select id="sp"><option>50</option><option selected>70</option><option>80</option></select> %</label><button class="btn pri" id="cmp">Comparer</button></div><div id="co"></div>`);
  $('#m').value = st.mode; let last = [];
  const nums = (s) => s.split(/[\s,;]+/).filter(Boolean).map(Number);
  $('#go').onclick = () => {
    try {
      Object.assign(st, { mode: $('#m').value, count: +$('#c').value, include: $('#i').value, exclude: $('#x').value, per: $('#per').value }); pref.set('gen', st);
      const draws = byPeriod(st.per), gs = generateGrids({ mode: st.mode, count: st.count, include: nums(st.include), exclude: nums(st.exclude), draws, rng: mulberry32(randomSeed()), minEven: +$('#e1').value, maxEven: +$('#e2').value, minSum: +$('#s1').value, maxSum: +$('#s2').value });
      last = gs; $('#out').innerHTML = gs.map((g, k) => `<div class="card" style="margin-top:10px"><b>Grille ${k + 1}</b> ${balls(g.numeros, g.numeroChance)}<p class="mu">Mode : ${esc(g.mode)} · somme ${g.somme} · ${g.pairs} pair(s)${state.draws.length ? ' · tirage historique le plus proche : ' + S.overlap(g.numeros, state.draws, 1).map((o) => `${o.date} (${o.common} numéros communs)`).join('') : ''}</p></div>`).join('');
    } catch (e) { $('#out').innerHTML = note(esc(e.message), 'er'); toast(e.message, true); }
  };
  $('#ex').onclick = () => (last.length ? download('lotomaths-grilles.csv', 'n1;n2;n3;n4;n5;chance\n' + last.map((g) => [...g.numeros, g.numeroChance].join(';')).join('\n') + '\n', 'text/csv') : toast("Générez d'abord des grilles.", true));
  $('#cmp').onclick = () => {
    const sp = +$('#sp').value / 100, cut = Math.floor(state.draws.length * sp), train = state.draws.slice(0, cut), test = state.draws.slice(cut);
    if (test.length < 30) return ($('#co').innerHTML = note('Historique insuffisant : au moins 30 tirages de test sont nécessaires.', 'er'));
    const f = S.frequencies(train), order = f.map((c, n) => [n, c]).slice(1).sort((a, b) => b[1] - a[1] || a[0] - b[0]).map((x) => x[0]);
    const strat = { 'Plus fréquents (appris)': order.slice(0, 5), 'Moins fréquents (appris)': order.slice(-5) }, rng = mulberry32(7), out = [];
    const ev = (grids) => { const m = []; for (const d of test) for (const g of grids) m.push(d.numeros.filter((x) => g.includes(x)).length); return m; };
    const rnd = []; for (let i = 0; i < 20; i++) rnd.push(drawNumbers(rng));
    out.push(['Aléatoire (20 grilles tirées)', ev(rnd)]); for (const [k, g] of Object.entries(strat)) out.push([k, ev([g])]);
    $('#co').innerHTML = `<p class="mu">Apprentissage : ${train.length} tirages (jusqu'au ${train.at(-1).date}) ; test : ${test.length} tirages postérieurs. Grilles construites uniquement avec l'apprentissage. Moyenne théorique : ${fmtNum(25 / 49, 4)} numéros corrects.</p><div class="tw"><table><thead><tr><th>Stratégie</th><th>Évaluations</th><th>Moy. bons numéros</th><th>IC 95 % (approx.)</th><th>≥ 3 bons</th></tr></thead><tbody>${out.map(([k, m]) => { const dd = S.describe(m), h = 1.96 * dd.sd / Math.sqrt(m.length); return `<tr><td>${k}</td><td>${m.length}</td><td>${fmtNum(dd.mean, 4)}</td><td>${fmtNum(dd.mean - h, 3)} – ${fmtNum(dd.mean + h, 3)}</td><td>${m.filter((x) => x >= 3).length}</td></tr>`; }).join('')}</tbody></table></div>${note('Si l\'intervalle d\'une stratégie contient la référence aléatoire (et la valeur théorique), aucune supériorité n\'est démontrée. Les évaluations d\'une même grille sur des tirages successifs ne sont pas rigoureusement indépendantes d\'une grille à l\'autre ; une seule découpe et une seule expérience ne suffisent pas à conclure.')}`;
  };
};

pages.import = (el) => {
  const v = state.draws.length;
  el.innerHTML = card('État des données', `<p>Source active : <b>${esc(state.source || 'aucune')}</b> — ${v.toLocaleString('fr-FR')} tirage(s) — période ${rangeText()}.</p>${state.loadError ? note(esc(state.loadError), 'er') : ''}${v ? `<button class="btn" id="dj">Télécharger JSON</button> <button class="btn" id="dc">Télécharger CSV</button>` : ''}`) +
    card('Importer un fichier', `<p class="mu">CSV (<code>date;n1;n2;n3;n4;n5;chance</code>, séparateur ; , ou tabulation, dates AAAA-MM-JJ ou JJ/MM/AAAA) ou JSON (<code>[{"date","numeros":[…],"numeroChance"}]</code>). 5 Mo max. Régime pris en charge : 5/49 + Chance 1–10, tirages à partir du ${R.from}.</p><input type="file" id="file" accept=".csv,.json,.txt" aria-label="Fichier à importer"><div id="prev"></div>`);
  if (v) { $('#dj').onclick = () => download('lotomaths-tirages.json', JSON.stringify(state.draws, null, 1), 'application/json'); $('#dc').onclick = () => download('lotomaths-tirages.csv', toCsv(state.draws), 'text/csv'); }
  $('#file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return; const pv = $('#prev');
    if (f.size > 5 * 1024 * 1024) return (pv.innerHTML = note('Fichier trop volumineux (5 Mo maximum).', 'er'));
    const { rows, error } = parseFileText(f.name, await f.text());
    if (error) return (pv.innerHTML = note(esc(error), 'er'));
    const r = validateDataset(rows);
    pv.innerHTML = `<p><b>${r.draws.length}</b> tirage(s) valide(s), <b>${r.errors.length}</b> erreur(s).</p>` + (r.errors.length ? note('Importation impossible tant que le fichier contient des erreurs ; vos données actuelles sont conservées.', 'er') + `<ul>${r.errors.slice(0, 30).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${r.errors.length > 30 ? `<p class="mu">… ${r.errors.length - 30} autres erreurs.</p>` : ''}` : `<p>Aperçu : ${r.draws.slice(0, 3).map((d) => `${d.date} ${d.numeros.join(' ')} / ${d.numeroChance}`).join(' · ')} … ${r.draws.at(-1).date}</p><button class="btn pri" id="ok">Remplacer l'historique (${r.draws.length} tirages)</button>`);
    const ok = $('#ok'); if (ok) ok.onclick = () => { state.draws = r.draws; state.source = `import manuel : ${f.name}`; state.loadError = null; state.updated = new Date().toISOString().slice(0, 10); toast('Historique importé (en mémoire pour cette session).'); refreshStatus(); pages.import(el); };
  };
};

pages.docs = (el) => {
  el.innerHTML = card('Préférences', `<button class="btn" id="th">Changer de thème</button> <button class="btn" id="rst">Réinitialiser les préférences locales</button>`) +
    card('Principe scientifique', `<p>Le Loto produit des tirages aléatoires. LotoMaths ne prédit rien : il distingue observations historiques, probabilités théoriques, tests et conclusions justifiées. Une fréquence élevée ou un grand retard n'augmente pas la probabilité d'un numéro.</p>`) +
    card('Formules', `<ul><li>C(n,k) = n! / (k!(n−k)!) — calcul exact en BigInt.</li><li>P(k bons numéros) = C(5,k)·C(44,5−k)/C(49,5) (loi hypergéométrique) ; avec Chance : × 1/10 (bon) ou 9/10 (mauvais).</li><li>Fréquence d'un numéro : p = 5/49 ; apparitions ~ Binomiale(N, 5/49) ; IC de Wilson.</li><li>Paire : 5/588 ; triplet : C(46,2)/C(49,5).</li><li>Somme : E = 125, min 15, max 235.</li><li>Attente : géométrique, P(X > k) = (1−p)^k.</li><li>Khi-deux, test z (approx. normale), Bonferroni, Benjamini-Hochberg, p-valeur empirique par simulation.</li></ul>`) +
    card('Données et limites', `<p>Aucune donnée officielle n'est livrée. Source recommandée : fichiers historiques publiés par la Française des Jeux (vérifier les conditions de réutilisation). Régimes antérieurs au ${R.from} (6/49 + complémentaire) non pris en charge. La grille des gains n'est pas intégrée. Les données importées manuellement ne sont conservées qu'en mémoire pour la session : télécharger puis remplacer <code>data/tirages.json</code> pour les publier.</p>`);
  $('#th').onclick = toggleTheme; $('#rst').onclick = () => { try { Object.keys(localStorage).filter((k) => k.startsWith('lm.')).forEach((k) => localStorage.removeItem(k)); } catch {} setTheme('dark'); toast('Préférences réinitialisées.'); };
};

// ---------- Shell ----------
function setTheme(t) { document.documentElement.dataset.theme = t; pref.set('theme', t); }
function toggleTheme() { setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); }
function refreshStatus() { const s = $('#status'); s.className = 'badge ' + (state.loadError ? 'er' : state.draws.length ? 'ok' : 'wa'); s.textContent = state.loadError ? 'Données : erreur' : state.draws.length ? `${state.draws.length.toLocaleString('fr-FR')} tirages validés` : 'Aucune donnée'; }
function route() {
  const id = (location.hash.slice(1) || 'dashboard'), pid = pages[id] ? id : 'dashboard';
  $('#nav').innerHTML = PAGES.map(([k, l]) => `<a href="#${k}" ${k === pid ? 'aria-current="page"' : ''}>${l}</a>`).join('');
  $('#title').textContent = PAGES.find((p) => p[0] === pid)[1]; document.title = `${$('#title').textContent} — LotoMaths`;
  try { pages[pid]($('#main')); } catch (e) { console.error(e); $('#main').innerHTML = note('Erreur inattendue : ' + esc(e.message), 'er'); }
  window.scrollTo(0, 0);
}
setTheme(pref.get('theme', 'dark')); $('#theme').onclick = toggleTheme;
window.addEventListener('hashchange', route);
load().then(() => { refreshStatus(); route(); });
