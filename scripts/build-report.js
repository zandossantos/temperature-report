/**
 * Build the temperature report for Vercel. Reads data/summary.json, writes public/index.html.
 * No env vars needed. No connection to your main Polymarket project.
 */
const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const SUMMARY_PATH = path.join(cwd, 'data', 'summary.json');
const OUTPUT_PATH = path.join(cwd, 'public', 'index.html');

/** Strip trailing outcome-like suffix from slug so event URLs are correct (no -6c, -34-35f). */
function normalizeEventSlug(slug) {
  if (!slug || typeof slug !== 'string') return '';
  const s = slug.trim();
  if (!s) return '';
  return s.replace(/-\d+([cf]|-\d+[cf])?$/i, '');
}

/** Ensure slug matches Polymarket URL format: highest-temperature-in-{city}-on-{month}-{day}-{year} (e.g. march-6-2026). Appends year from dateKey if slug has no year. */
function toPolymarketSlugFormat(slug, dateKey) {
  if (!slug || typeof slug !== 'string') return '';
  let s = normalizeEventSlug(slug).toLowerCase().trim();
  if (!s) return '';
  const monthDayYear = s.match(/-on-(january|february|march|april|may|june|july|august|september|october|november|december)-(\d{1,2})-(\d{4})$/);
  if (monthDayYear) {
    const month = monthDayYear[1];
    const day = String(parseInt(monthDayYear[2], 10));
    const year = monthDayYear[3];
    s = s.replace(/-on-(january|february|march|april|may|june|july|august|september|october|november|december)-\d{1,2}-\d{4}$/, `-on-${month}-${day}-${year}`);
    return s;
  }
  const monthDayOnly = s.match(/-on-(january|february|march|april|may|june|july|august|september|october|november|december)-(\d{1,2})$/);
  if (monthDayOnly && dateKey && typeof dateKey === 'string') {
    const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) s = s + '-' + m[1];
  }
  return s;
}

function isValidDateKey(dateKey) {
  if (!dateKey || typeof dateKey !== 'string') return false;
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/** Safe: always returns arrays. Handles old shape (outcomes = string[], logged = { [o]: { price, ts } }) and new (outcomes = { [o]: { currentPrice, outcomeHit15c } }). */
function normalizeCellForReport(cell) {
  const empty = { outcomes: [], loggedList: [], missing: [], outcomeDetails: {}, slug: '' };
  if (!cell || typeof cell !== 'object') return empty;
  const slug = (cell.slug != null && typeof cell.slug === 'string') ? cell.slug.trim() : '';
  const rawOutcomes = cell.outcomes;
  const rawLogged = cell.logged && typeof cell.logged === 'object' ? cell.logged : {};
  if (rawOutcomes == null) return empty;
  const outcomeDetails = {};
  let outcomes = [];
  const loggedList = [];

  if (Array.isArray(rawOutcomes)) {
    outcomes = rawOutcomes.slice().sort();
    for (const o of outcomes) {
      const hit = rawLogged[o];
      outcomeDetails[o] = { currentPrice: null, outcomeHit15c: hit && typeof hit === 'object' ? { price: hit.price, ts: hit.ts } : null };
      if (hit) loggedList.push([o, hit]);
    }
  } else if (typeof rawOutcomes === 'object') {
    try {
      outcomes = Object.keys(rawOutcomes).slice().sort();
    } catch (_) {}
    for (const o of outcomes) {
      const v = rawOutcomes[o];
      outcomeDetails[o] = v && typeof v === 'object' ? { currentPrice: v.currentPrice, outcomeHit15c: v.outcomeHit15c } : { currentPrice: null, outcomeHit15c: null };
      if (outcomeDetails[o].outcomeHit15c) loggedList.push([o, outcomeDetails[o].outcomeHit15c]);
    }
  }
  const missing = outcomes.filter((o) => !(outcomeDetails[o] && outcomeDetails[o].outcomeHit15c));
  return { outcomes, loggedList, missing, outcomeDetails, slug };
}

function buildHtml(summary) {
  const byDate = summary.by_date || {};
  const dates = Object.keys(byDate).filter(isValidDateKey).sort();
  let totalOutcomes = 0;
  let totalLogged = 0;
  const byDateKey = {};
  for (const date of dates) {
    const cities = byDate[date] || {};
    const cityNames = Object.keys(cities).sort();
    byDateKey[date] = [];
    for (const city of cityNames) {
      const cell = cities[city];
      const norm = normalizeCellForReport(cell);
      const outcomes = Array.isArray(norm.outcomes) ? norm.outcomes : [];
      const loggedList = Array.isArray(norm.loggedList) ? norm.loggedList : [];
      const missing = Array.isArray(norm.missing) ? norm.missing : [];
      const outcomeDetails = norm.outcomeDetails && typeof norm.outcomeDetails === 'object' ? norm.outcomeDetails : {};
      const cellSlug = norm.slug;
      if (outcomes.length === 0) continue;
      totalOutcomes += outcomes.length;
      totalLogged += loggedList.length;
      const pct = Math.round((loggedList.length / outcomes.length) * 100);
      const slug = cellSlug ? (toPolymarketSlugFormat(cellSlug, date) || cellSlug.toLowerCase().trim()) : '';
      byDateKey[date].push({
        date,
        city,
        slug,
        outcomes,
        logged: loggedList,
        missing,
        outcomeDetails,
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
      return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
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
        const loggedList = r.logged.map(([o, v]) => '<span class="ok">' + escapeHtml(o) + '</span> <span class="ts">' + (v && v.price != null ? (v.price * 100).toFixed(1) + '¢' : '') + '</span>').join(', ');
        const missingList = r.missing.map(o => '<span class="miss">' + escapeHtml(o) + '</span>').join(', ');
        const detailsHtml = (r.outcomes || []).map(o => {
          const det = r.outcomeDetails && r.outcomeDetails[o];
          const currentStr = det && det.currentPrice != null ? (det.currentPrice * 100).toFixed(1) + '¢' : '—';
          const hitStr = det && det.outcomeHit15c ? (det.outcomeHit15c.price != null ? (det.outcomeHit15c.price * 100).toFixed(1) + '¢' : '') + (det.outcomeHit15c.ts ? ' <span class="ts">' + escapeHtml(formatTs(det.outcomeHit15c.ts)) + '</span>' : '') : '—';
          const cls = det && det.outcomeHit15c ? 'ok' : 'miss';
          return '<span class="' + cls + '">' + escapeHtml(o) + '</span> current: ' + currentStr + ' · hit 15¢: ' + hitStr;
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
  let byDate = summary.by_date || {};
  if (Object.keys(byDate).length === 0 && typeof summary === 'object') {
    const topKeys = Object.keys(summary).filter((k) => isValidDateKey(k));
    if (topKeys.length > 0) {
      byDate = summary;
      console.warn('summary.json has no "by_date" wrapper; using top-level date keys.');
    }
  }
  const dateCount = Object.keys(byDate).length;
  let cellCount = 0;
  for (const cities of Object.values(byDate)) cellCount += Object.keys(cities || {}).length;
  if (dateCount === 0 || cellCount === 0) {
    console.warn('summary.json has no data: by_date has %s date(s), %s city cell(s). Push script must run after tracker has written data.', dateCount, cellCount);
  } else {
    console.log('Building report from %s date(s), %s city cell(s)', dateCount, cellCount);
  }
  const html = buildHtml({ by_date: byDate });
  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
  console.log('Built public/index.html');
}

main();
