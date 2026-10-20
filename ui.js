// Composants d'interface réutilisables.
import { esc } from './charts.js';
export const $ = (s, r = document) => r.querySelector(s);
export function toast(msg, err = false) { const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (err ? ' er' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = 'toast'), 3500); }
export const card = (title, body, cls = '') => `<section class="card ${cls}">${title ? `<h2>${esc(title)}</h2>` : ''}${body}</section>`;
export const stat = (l, v) => `<div class="card stat"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`;
export const balls = (nums, chance) => nums.map((n) => `<span class="ball">${n}</span>`).join('') + (chance ? `<span class="ball c" title="Numéro Chance">${chance}</span>` : '');
export const note = (t, cls = '') => `<p class="note ${cls}">${t}</p>`;
export function download(name, text, type = 'text/plain') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
/** Tableau triable + pagination. cols:[{k,label,fmt?,sort?:true}] */
export function dataTable(host, cols, rows, { sortKey, dir = 'desc', pageSize = 0, caption = '' } = {}) {
  let page = 0, sk = sortKey, d = dir;
  const draw = () => {
    let r = [...rows];
    if (sk) r.sort((a, b) => { const x = a[sk], y = b[sk]; const c = x == null ? 1 : y == null ? -1 : typeof x === 'string' ? x.localeCompare(y) : x - y; return d === 'asc' ? c : -c; });
    const pages = pageSize ? Math.max(1, Math.ceil(r.length / pageSize)) : 1; page = Math.min(page, pages - 1);
    const vis = pageSize ? r.slice(page * pageSize, (page + 1) * pageSize) : r;
    host.innerHTML = `<div class="tw"><table><caption class="mu" style="text-align:left">${esc(caption)}</caption><thead><tr>${cols.map((c) => `<th scope="col" ${c.k === sk ? `aria-sort="${d === 'asc' ? 'ascending' : 'descending'}" data-arrow="${d === 'asc' ? ' ▲' : ' ▼'}"` : ''}><button data-k="${c.k}">${esc(c.label)}</button></th>`).join('')}</tr></thead><tbody>${vis.map((x) => `<tr>${cols.map((c) => `<td>${c.html ? c.html(x) : esc(c.fmt ? c.fmt(x[c.k], x) : x[c.k] ?? '—')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" class="empty">Aucun résultat.</td></tr>`}</tbody></table></div>` +
      (pageSize ? `<div class="pg"><button class="btn" data-p="-1" ${page === 0 ? 'disabled' : ''}>← Précédent</button><span>Page ${page + 1} / ${pages} — ${r.length.toLocaleString('fr-FR')} lignes</span><button class="btn" data-p="1" ${page >= pages - 1 ? 'disabled' : ''}>Suivant →</button></div>` : '');
    host.querySelectorAll('th button').forEach((b) => (b.onclick = () => { d = sk === b.dataset.k && d === 'desc' ? 'asc' : 'desc'; sk = b.dataset.k; page = 0; draw(); }));
    host.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { page += +b.dataset.p; draw(); }));
  };
  draw();
}
