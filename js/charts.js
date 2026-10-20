// Graphiques SVG sans dépendance ; chaque graphique porte un titre/description accessibles.
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** bars({labels, values, ref?:number|number[], title, desc, fmt}) */
export function barChart({ labels, values, ref, title, desc, fmt = (v) => v, step = 1 }) {
  const W = 640, H = 220, L = 44, B = 24, T = 10, n = values.length;
  const refs = ref == null ? [] : Array.isArray(ref) ? ref : Array(n).fill(ref);
  const max = Math.max(...values, ...refs, 1e-9), bw = (W - L - 6) / n;
  const y = (v) => T + (H - T - B) * (1 - v / max);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><desc>${esc(desc || '')}</desc>`;
  for (const f of [0, 0.5, 1]) s += `<text x="${L - 4}" y="${y(max * f) + 3}" text-anchor="end">${esc(fmt(max * f))}</text><line x1="${L}" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}" stroke="var(--bd)"/>`;
  values.forEach((v, i) => { const x = L + i * bw; s += `<rect class="bar" x="${x + 1}" y="${y(v)}" width="${Math.max(1, bw - 2)}" height="${H - B - y(v)}"><title>${esc(labels[i])} : ${esc(fmt(v))}</title></rect>`; if (i % step === 0) s += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(labels[i])}</text>`; });
  if (refs.length) s += `<polyline class="ref" points="${refs.map((v, i) => `${L + i * bw + bw / 2},${y(v)}`).join(' ')}"/>`;
  return s + '</svg>';
}
export function lineChart({ labels, series, title, desc, fmt = (v) => v }) {
  const W = 640, H = 220, L = 44, B = 24, T = 10, all = series.flatMap((s) => s.values), max = Math.max(...all, 1e-9), min = Math.min(...all, 0), n = labels.length;
  const x = (i) => L + (i * (W - L - 8)) / Math.max(1, n - 1), y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min || 1));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><desc>${esc(desc || '')}</desc>`;
  for (const f of [min, (min + max) / 2, max]) s += `<text x="${L - 4}" y="${y(f) + 3}" text-anchor="end">${esc(fmt(f))}</text><line x1="${L}" x2="${W}" y1="${y(f)}" y2="${y(f)}" stroke="var(--bd)"/>`;
  series.forEach((se, k) => (s += `<polyline fill="none" stroke="${k ? 'var(--ac2)' : 'var(--ac)'}" stroke-width="2" ${k ? 'stroke-dasharray="4 3"' : ''} points="${se.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"><title>${esc(se.name)}</title></polyline>`));
  s += `<text x="${L}" y="${H - 8}">${esc(labels[0])}</text><text x="${W - 8}" y="${H - 8}" text-anchor="end">${esc(labels[n - 1])}</text>`;
  return s + '</svg>';
}
