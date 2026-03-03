/**
 * Build the temperature report for Vercel. Reads data/summary.json, writes public/index.html.
 * No env vars needed. No connection to your main Polymarket project.
 */
const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const SUMMARY_PATH = path.join(cwd, 'data', 'summary.json');
const OUTPUT_PATH = path.join(cwd, 'public', 'index.html');

function fallbackSlug(date, city) {
  if (!date || !city || typeof date !== 'string' || typeof city !== 'string') return '';
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthName = months[parseInt(m[2], 10) - 1] || '';
  const day = parseInt(m[3], 10);
  const year = m[1];
  if (!monthName) return '';
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  return `highest-temperature-in-${citySlug}-on-${monthName}-${day}-${year}`;
}

function buildHtml(summary) {
  const byDate = summary.by_date || {};
  const dates = Object.keys(byDate).sort();
  let totalOutcomes = 0;
  let totalLogged = 0;
  const byDateKey = {};
  for (const date of dates) {
    const cities = byDate[date] || {};
    const cityNames = Object.keys(cities).sort();
    byDateKey[date] = [];
    for (const city of cityNames) {
      const cell = cities[city];
      const outcomes = cell.outcomes || [];
      const logged = cell.logged || {};
      const loggedList = Object.entries(logged);
      const missing = outcomes.filter((o) => !logged[o]);
      totalOutcomes += outcomes.length;
      totalLogged += loggedList.length;
      const pct = outcomes.length ? Math.round((loggedList.length / outcomes.length) * 100) : 0;
      const slug = cell.slug || fallbackSlug(date, city);
      byDateKey[date].push({
        date,
        city,
        slug: slug || '',
        outcomes,
        logged: loggedList,
        missing,
        total: outcomes.length,
        loggedCount: loggedList.length,
        pct,
      });
    }
  }
  const overallPct = totalOutcomes ? Math.round((totalLogged / totalOutcomes) * 100) : 0;
  const byDateKeyJson = JSON.stringify(byDateKey);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Temperature under 15¢ — report</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 1rem; background: #0f1419; color: #e6edf3; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    .summary { display: flex; gap: 1.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .summary .stat { background: #161b22; padding: 0.5rem 0.75rem; border-radius: 6px; }
    .summary .stat strong { color: #58a6ff; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #21262d; }
    th { color: #8b949e; font-weight: 600; }
    tr:hover { background: #161b22; }
    .progress { display: inline-block; width: 4rem; height: 0.5rem; background: #21262d; border-radius: 3px; overflow: hidden; vertical-align: middle; margin-right: 0.5rem; }
    .progress span { display: block; height: 100%; background: #238636; border-radius: 3px; }
    .progress.low span { background: #da3633; }
    .progress.mid span { background: #d29922; }
    .num { font-variant-numeric: tabular-nums; }
    .outcomes { font-size: 0.75rem; color: #8b949e; }
    .outcomes .ok { color: #3fb950; }
    .outcomes .miss { color: #f85149; }
    .ts { font-size: 0.7rem; color: #6e7681; }
    details { margin-top: 0.25rem; }
    summary { cursor: pointer; color: #58a6ff; }
    .date-section { margin-bottom: 2rem; }
    .date-heading { font-size: 1.1rem; margin: 0 0 0.75rem; color: #8b949e; border-bottom: 1px solid #21262d; padding-bottom: 0.25rem; }
    .event-link a { color: #58a6ff; text-decoration: none; }
    .event-link a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Temperature under 15¢ — tracker report</h1>
  <p style="color:#8b949e; margin:0 0 1rem;">One row per (date, city). Logged = outcome went under 15¢ at least once.</p>
  <div class="summary">
    <div class="stat">Total (date, city) pairs: <strong id="totalPairs">0</strong></div>
    <div class="stat">Outcomes logged: <strong class="num">${totalLogged}</strong> / <strong class="num">${totalOutcomes}</strong> (<strong>${overallPct}%</strong>)</div>
  </div>
  <div id="sections"></div>
  <script>
    const byDateKey = ${byDateKeyJson};
    const EVENT_BASE = 'https://polymarket.com/event/';
    function escapeHtml(s) {
      if (s == null) return '';
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }
    function formatTs(ts) {
      if (!ts) return '';
      var d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    }
    function formatDateHeader(dateKey) {
      if (!dateKey || typeof dateKey !== 'string') return dateKey || 'Unknown date';
      const parts = dateKey.split('-');
      if (parts.length >= 3) {
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = months[monthNum - 1];
        if (monthName && !isNaN(day) && year.length === 4) return monthName + ' ' + day + ', ' + year;
      }
      return dateKey;
    }
    let totalPairs = 0;
    const sectionsEl = document.getElementById('sections');
    const dates = Object.keys(byDateKey).sort();
    for (const date of dates) {
      const rows = byDateKey[date];
      totalPairs += rows.length;
      const section = document.createElement('section');
      section.className = 'date-section';
      section.innerHTML = '<h2 class="date-heading">' + escapeHtml(formatDateHeader(date)) + '</h2>';
      const table = document.createElement('table');
      table.innerHTML = '<thead><tr><th>City</th><th>Progress</th><th>Logged</th><th>Missing</th><th>Event</th><th>Details</th></tr></thead><tbody></tbody>';
      const tbody = table.querySelector('tbody');
      for (const r of rows) {
        const tr = document.createElement('tr');
        const pctClass = r.pct >= 100 ? '' : r.pct >= 50 ? 'mid' : 'low';
        const loggedList = r.logged.map(([o, v]) => '<span class="ok">' + escapeHtml(o) + '</span> <span class="ts">' + (v.price != null ? (v.price * 100).toFixed(1) + '¢' : '') + '</span>').join(', ');
        const missingList = r.missing.map(o => '<span class="miss">' + escapeHtml(o) + '</span>').join(', ');
        const detailsHtml = r.outcomes.map(o => {
          const v = r.logged.find(x => x[0] === o)?.[1];
          if (v) return '<span class="ok">' + escapeHtml(o) + '</span> ' + (v.price != null ? (v.price * 100).toFixed(1) + '¢' : '') + (v.ts ? ' <span class="ts">' + escapeHtml(formatTs(v.ts)) + '</span>' : '');
          return '<span class="miss">' + escapeHtml(o) + '</span>';
        }).join('<br>');
        const eventCell = r.slug
          ? '<a href="' + escapeHtml(EVENT_BASE + r.slug) + '" target="_blank" rel="noopener">View on Polymarket</a>'
          : '—';
        tr.innerHTML =
          '<td>' + escapeHtml(r.city) + '</td>' +
          '<td><div class="progress ' + pctClass + '"><span style="width:' + r.pct + '%"></span></div><span class="num">' + r.loggedCount + '/' + r.total + '</span> (' + r.pct + '%)</td>' +
          '<td class="outcomes">' + (loggedList || '—') + '</td>' +
          '<td class="outcomes">' + (missingList || '—') + '</td>' +
          '<td class="event-link">' + eventCell + '</td>' +
          '<td><details><summary>Outcomes</summary><div class="outcomes">' + detailsHtml + '</div></details></td>';
        tbody.appendChild(tr);
      }
      section.appendChild(table);
      sectionsEl.appendChild(section);
    }
    document.getElementById('totalPairs').textContent = totalPairs;
  </script>
</body>
</html>`;
}

function main() {
  if (!fs.existsSync(SUMMARY_PATH)) {
    console.error('Missing data/summary.json. Copy it from your tracker (PM/temperature-under-15c/summary.json) into the data/ folder.');
    process.exit(1);
  }
  const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
  const html = buildHtml(summary);
  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
  console.log('Built public/index.html');
}

main();
