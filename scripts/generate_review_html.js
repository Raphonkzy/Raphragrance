const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

const publicDb = new DatabaseSync('data/perfumes.public.db');
const fullDb = new DatabaseSync('data/perfumes.full.db');

let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
} catch (e) {
  console.warn('Could not read git rev:', e.message);
}

// PRNG for deterministic stratified sampling
function makePrng(seed = 12345) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const rng = makePrng(999);

// Gate 1.1 & Gate 9: Load all verified anchors from data/anchors.json
const anchorsJson = JSON.parse(fs.readFileSync('data/anchors.json', 'utf8'));
const namedIds = anchorsJson.map(a => a.id);
const namedSet = new Set(namedIds);

// Stratified sampling
function sampleRows(query, limit = 8) {
  const all = publicDb.prepare(query).all();
  const pool = all.filter(r => !namedSet.has(r.id));
  const selected = [];
  const chosenIndices = new Set();
  while (selected.length < limit && selected.length < pool.length) {
    const idx = Math.floor(rng() * pool.length);
    if (!chosenIndices.has(idx)) {
      chosenIndices.add(idx);
      selected.push(pool[idx]);
    }
  }
  return selected;
}

const popRows = sampleRows("SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, image_url, year, gender FROM perfumes WHERE vote_count >= 1000 ORDER BY vote_count DESC LIMIT 500", 8);
const midRows = sampleRows("SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, image_url, year, gender FROM perfumes WHERE vote_count >= 100 AND vote_count < 1000 LIMIT 500", 8);
const longTailRows = sampleRows("SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, image_url, year, gender FROM perfumes WHERE vote_count >= 1 AND vote_count <= 30 AND accords IS NOT NULL LIMIT 500", 8);
const cloneRows = sampleRows("SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, image_url, year, gender FROM perfumes WHERE brand IN ('Afnan', 'Armaf', 'Lattafa Perfumes', 'Maison Alhambra', 'Al Haramain Perfumes', 'Rasasi', 'Paris Corner') AND vote_count >= 30 LIMIT 500", 8);
const flatOnlyRows = sampleRows("SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, image_url, year, gender FROM perfumes WHERE (notes_top IS NULL OR notes_top = '') AND (notes_middle IS NULL OR notes_middle = '') AND (notes_base IS NULL OR notes_base = '') AND notes_flat IS NOT NULL AND notes_flat != '' AND vote_count >= 10 LIMIT 500", 8);

const stmtPerfume = fullDb.prepare("SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, image_url, year, gender FROM perfumes WHERE id = ?");

const targets = [];

// 1. Add Named Anchors (All 19)
for (const id of namedIds) {
  const p = stmtPerfume.get(id);
  if (p) targets.push({ ...p, stratum: "Named Anchor" });
}

// 2. Add Stratified
popRows.forEach(p => targets.push({ ...p, stratum: "Popular" }));
midRows.forEach(p => targets.push({ ...p, stratum: "Mid" }));
longTailRows.forEach(p => targets.push({ ...p, stratum: "Long-Tail" }));
cloneRows.forEach(p => targets.push({ ...p, stratum: "Clone Houses" }));
flatOnlyRows.forEach(p => targets.push({ ...p, stratum: "Flat-Only Notes" }));

console.log(`Total review targets selected: ${targets.length}`);

function parseNotes(p) {
  const all = [p.notes_top, p.notes_middle, p.notes_base, p.notes_flat]
    .filter(Boolean)
    .join('|')
    .toLowerCase()
    .split('|')
    .map(s => s.trim())
    .filter(Boolean);
  return Array.from(new Set(all));
}

function getSharedNotes(targetNotes, candNotes) {
  const targetSet = new Set(targetNotes);
  const shared = [];
  for (const cn of candNotes) {
    for (const tn of targetSet) {
      if (cn === tn || (cn.length > 4 && (tn.includes(cn) || cn.includes(tn)))) {
        shared.push(cn);
        break;
      }
    }
  }
  return Array.from(new Set(shared));
}

const stmtPublicCurated = publicDb.prepare(`
  SELECT s.similar_id, s.score, s.source, p.*
  FROM similar s
  JOIN perfumes p ON p.id = s.similar_id
  WHERE s.fragrance_id = ? AND s.source = 'curated'
  ORDER BY s.rank ASC
  LIMIT 10
`);

const stmtPublicContent = publicDb.prepare(`
  SELECT s.similar_id, s.score, s.source, p.*
  FROM similar s
  JOIN perfumes p ON p.id = s.similar_id
  WHERE s.fragrance_id = ? AND s.source = 'content'
  ORDER BY s.rank ASC
  LIMIT 30
`);

const stmtFullCurated = fullDb.prepare(`
  SELECT s.similar_id, s.score, s.source, p.*
  FROM similar s
  JOIN perfumes p ON p.id = s.similar_id
  WHERE s.fragrance_id = ? AND s.source = 'curated'
  ORDER BY s.rank ASC
  LIMIT 10
`);

const stmtFullCommunity = fullDb.prepare(`
  SELECT s.similar_id, s.score, s.source, p.*
  FROM similar s
  JOIN perfumes p ON p.id = s.similar_id
  WHERE s.fragrance_id = ? AND s.source = 'community'
  ORDER BY s.rank ASC
  LIMIT 30
`);

const stmtFullContent = fullDb.prepare(`
  SELECT s.similar_id, s.score, s.source, p.*
  FROM similar s
  JOIN perfumes p ON p.id = s.similar_id
  WHERE s.fragrance_id = ? AND s.source = 'content'
  ORDER BY s.rank ASC
  LIMIT 30
`);

function getTargetPackage(target) {
  const targetNotes = parseNotes(target);

  // Content list (Public DB) with brand diversity cap <= 2
  const contentRaw = [];
  const contentSeen = new Set([target.id]);
  const contentBrandCounts = new Map();

  function tryAddContent(r) {
    if (contentSeen.has(r.id)) return false;
    const cnt = contentBrandCounts.get(r.brand) || 0;
    if (cnt >= 2) return false;
    contentBrandCounts.set(r.brand, cnt + 1);
    contentSeen.add(r.id);
    contentRaw.push(r);
    return true;
  }

  for (const r of stmtPublicCurated.all(target.id)) {
    tryAddContent(r);
    if (contentRaw.length >= 10) break;
  }
  if (contentRaw.length < 10) {
    for (const r of stmtPublicContent.all(target.id)) {
      tryAddContent(r);
      if (contentRaw.length >= 10) break;
    }
  }

  const contentItems = contentRaw.map((r, idx) => {
    const cNotes = parseNotes(r);
    const shared = getSharedNotes(targetNotes, cNotes);
    let label = "";
    if (r.source === 'curated') {
      label = "Curated pick";
    } else if (shared.length > 0) {
      label = `Shares: ${shared.slice(0, 3).join(', ')}`;
    } else {
      label = "Similar olfactory profile";
    }
    return {
      rank: idx + 1,
      id: r.id,
      name: r.name,
      brand: r.brand,
      year: r.year,
      source: r.source,
      label,
      sharedNotes: shared,
      image_url: r.image_url
    };
  });

  // Hybrid list (Full DB) with brand diversity cap <= 2
  const hybridRaw = [];
  const hybridSeen = new Set([target.id]);
  const hybridBrandCounts = new Map();

  function tryAddHybrid(r) {
    if (hybridSeen.has(r.id)) return false;
    const cnt = hybridBrandCounts.get(r.brand) || 0;
    if (cnt >= 2) return false;
    hybridBrandCounts.set(r.brand, cnt + 1);
    hybridSeen.add(r.id);
    hybridRaw.push(r);
    return true;
  }

  for (const r of stmtFullCurated.all(target.id)) {
    tryAddHybrid(r);
    if (hybridRaw.length >= 10) break;
  }
  if (hybridRaw.length < 10) {
    for (const r of stmtFullCommunity.all(target.id)) {
      tryAddHybrid(r);
      if (hybridRaw.length >= 10) break;
    }
  }
  if (hybridRaw.length < 10) {
    for (const r of stmtFullContent.all(target.id)) {
      tryAddHybrid(r);
      if (hybridRaw.length >= 10) break;
    }
  }

  const hybridItems = hybridRaw.map((r, idx) => {
    const cNotes = parseNotes(r);
    const shared = getSharedNotes(targetNotes, cNotes);
    let label = "";
    if (r.source === 'curated') {
      label = "Curated pick";
    } else if (r.source === 'community') {
      label = "Community pick";
    } else if (shared.length > 0) {
      label = `Shares: ${shared.slice(0, 3).join(', ')}`;
    } else {
      label = "Similar olfactory profile";
    }
    return {
      rank: idx + 1,
      id: r.id,
      name: r.name,
      brand: r.brand,
      year: r.year,
      source: r.source,
      label,
      sharedNotes: shared,
      image_url: r.image_url
    };
  });

  return {
    target: {
      id: target.id,
      name: target.name,
      brand: target.brand,
      year: target.year,
      gender: target.gender,
      vote_count: target.vote_count,
      stratum: target.stratum,
      image_url: target.image_url,
      notes: targetNotes.slice(0, 15).join(', ')
    },
    contentItems,
    hybridItems
  };
}

console.log('Generating packages for each target...');
const packages = targets.map(getTargetPackage);

// HTML Template with XSS sanitization and robust import/export
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Raphragrance Similarity Quality Review</title>
  <style>
    :root {
      --bg: #F8F8F6;
      --card: #FFFFFF;
      --fg: #1A1A18;
      --mu: #6E6E6A;
      --line: #E5E5E0;
      --accent: #2563EB;
      --green: #10B981;
      --red: #EF5350;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: var(--font);
      background: var(--bg);
      color: var(--fg);
      -webkit-font-smoothing: antialiased;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--line);
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .title { font-size: 20px; font-weight: 700; }
    .subtitle { font-size: 13px; color: var(--mu); margin-top: 2px; }
    .meta-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 14px;
    }
    .btn-export, .btn-import {
      background: var(--accent);
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
    }
    .btn-import { background: #4B5563; }
    .btn-export:hover { opacity: 0.9; }
    .filter-bar {
      padding: 12px 32px;
      background: #fff;
      border-bottom: 1px solid var(--line);
      display: flex;
      gap: 8px;
      overflow-x: auto;
    }
    .filter-btn {
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid var(--line);
      background: transparent;
      font-size: 13px;
      cursor: pointer;
      color: var(--mu);
    }
    .filter-btn.active {
      background: var(--fg);
      color: #fff;
      border-color: var(--fg);
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 32px;
    }
    .fragrance-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      margin-bottom: 32px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    }
    .card-header {
      padding: 18px 24px;
      background: #FAFAF9;
      border-bottom: 1px solid var(--line);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .stratum-tag {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 8px;
      border-radius: 6px;
      background: #E5E7EB;
      color: #374151;
    }
    .side-by-side {
      display: grid;
      grid-template-columns: 280px 1fr 1fr;
      divide-x: 1px solid var(--line);
    }
    .target-col {
      padding: 24px;
      background: #FDFDFD;
      border-right: 1px solid var(--line);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .target-image-wrap {
      width: 100%;
      height: 240px;
      background: #FFFFFF;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--line);
    }
    .target-image-wrap img {
      max-height: 80%;
      max-width: 80%;
      object-fit: contain;
    }
    .target-brand { font-size: 13px; font-weight: 600; color: var(--mu); text-transform: uppercase; }
    .target-name { font-size: 18px; font-weight: 700; margin: 2px 0 6px; }
    .target-meta { font-size: 12px; color: var(--mu); }
    .target-notes-box { font-size: 12px; line-height: 1.4; }
    .rec-col {
      padding: 24px;
      border-right: 1px solid var(--line);
      display: flex;
      flex-direction: column;
    }
    .rec-col:last-child { border-right: none; }
    .rec-col-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .rec-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
    }
    .rec-item {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 8px 12px;
      border-radius: 10px;
      background: #FAFAF9;
      border: 1px solid var(--line);
    }
    .rec-rank { font-size: 12px; font-weight: 700; color: var(--mu); width: 20px; }
    .rec-thumb { width: 44px; height: 44px; object-fit: contain; background: #fff; border-radius: 6px; }
    .rec-info { flex: 1; min-width: 0; }
    .rec-brand { font-size: 11px; font-weight: 600; color: var(--mu); }
    .rec-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rec-label { font-size: 11px; color: #4B5563; }
    .rating-section {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px dashed var(--line);
    }
    .btn-group { display: flex; gap: 8px; margin-bottom: 8px; }
    .btn-rate {
      flex: 1;
      padding: 8px;
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-rate.good.active { background: #D1FAE5; color: #065F46; border-color: #10B981; }
    .btn-rate.ok.active { background: #FEF3C7; color: #92400E; border-color: #F59E0B; }
    .btn-rate.bad.active { background: #FEE2E2; color: #991B1B; border-color: #EF4444; }
    .comment-input {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="title">Raphragrance Similarity Quality Review Tool</div>
      <div class="subtitle">Blind/Side-by-side verification: Content-Only (Public DB) vs Hybrid Mode (Full DB) across ${packages.length} Stratified Fragrances</div>
    </div>
    <div class="meta-bar">
      <div>Total Fragrances: <strong id="stat-total">${packages.length}</strong></div>
      <div>Rated Content-Only: <strong id="stat-content-rated">0</strong> / ${packages.length}</div>
      <div>Rated Hybrid: <strong id="stat-hybrid-rated">0</strong> / ${packages.length}</div>
      <label class="btn-import">
        Import JSON
        <input type="file" id="import-input" accept=".json" style="display:none;" onchange="importRatings(event)">
      </label>
      <button class="btn-export" onclick="exportRatings()">Export Ratings JSON</button>
      <span id="save-status" style="font-size: 12px; color: var(--mu);"></span>
    </div>
  </header>

  <div class="filter-bar">
    <button class="filter-btn active" data-stratum="all" onclick="filterCards('all')">All (${packages.length})</button>
    <button class="filter-btn" data-stratum="Named Anchor" onclick="filterCards('Named Anchor')">Named Anchors (${namedIds.length})</button>
    <button class="filter-btn" data-stratum="Popular" onclick="filterCards('Popular')">Popular</button>
    <button class="filter-btn" data-stratum="Mid" onclick="filterCards('Mid')">Mid</button>
    <button class="filter-btn" data-stratum="Long-Tail" onclick="filterCards('Long-Tail')">Long-Tail</button>
    <button class="filter-btn" data-stratum="Clone Houses" onclick="filterCards('Clone Houses')">Clone Houses</button>
    <button class="filter-btn" data-stratum="Flat-Only Notes" onclick="filterCards('Flat-Only Notes')">Flat-Only Notes</button>
  </div>

  <div class="container" id="grid"></div>

  <script id="data-payload" type="application/json">
${JSON.stringify(packages)}
  </script>

  <script>
    const data = JSON.parse(document.getElementById("data-payload").textContent);
    const STORAGE_KEY = "aphragrance_review_state_v2";
    const GIT_COMMIT = "${gitCommit}";

    function escapeHtml(str) {
      if (str === null || str === undefined) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    let state = {};
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) state = JSON.parse(saved);
    } catch (e) {
      console.warn("Could not load local state:", e);
    }

    function saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        document.getElementById("save-status").textContent = "Saved locally (" + new Date().toLocaleTimeString() + ")";
        updateStats();
      } catch (e) {}
    }

    function setRating(targetId, mode, rating) {
      if (!state[targetId]) state[targetId] = {};
      if (!state[targetId][mode]) state[targetId][mode] = {};
      state[targetId][mode].rating = rating;
      saveState();
      renderButtons(targetId, mode);
    }

    function setComment(targetId, mode, comment) {
      if (!state[targetId]) state[targetId] = {};
      if (!state[targetId][mode]) state[targetId][mode] = {};
      state[targetId][mode].comment = comment;
      saveState();
    }

    function updateStats() {
      let cCount = 0;
      let hCount = 0;
      for (const id in state) {
        if (state[id].content && state[id].content.rating) cCount++;
        if (state[id].hybrid && state[id].hybrid.rating) hCount++;
      }
      document.getElementById("stat-content-rated").textContent = cCount;
      document.getElementById("stat-hybrid-rated").textContent = hCount;
    }

    function renderButtons(targetId, mode) {
      const curRating = state[targetId]?.[mode]?.rating;
      const el = document.getElementById(mode + "-btns-" + targetId);
      if (!el) return;
      el.querySelectorAll(".btn-rate").forEach(btn => {
        btn.classList.remove("active");
        if (btn.dataset.rate === curRating) btn.classList.add("active");
      });
    }

    function renderCards(filter = 'all') {
      const grid = document.getElementById("grid");
      grid.innerHTML = "";

      const placeholderSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%239A9A95" stroke-width="1.5"><rect x="6" y="7" width="12" height="14" rx="2"/><path d="M10 3h4v4h-4z"/></svg>';

      data.forEach(item => {
        if (filter !== 'all' && item.target.stratum !== filter) return;

        const t = item.target;
        const targetImg = t.image_url || placeholderSvg;

        const card = document.createElement("div");
        card.className = "fragrance-card";
        card.id = "card-" + t.id;

        const contentRating = state[t.id]?.content?.rating || "";
        const contentComment = state[t.id]?.content?.comment || "";
        const hybridRating = state[t.id]?.hybrid?.rating || "";
        const hybridComment = state[t.id]?.hybrid?.comment || "";

        card.innerHTML = \`
          <div class="card-header">
            <div>
              <span class="stratum-tag">\${escapeHtml(t.stratum)}</span>
              <strong style="margin-left: 8px;">\${escapeHtml(t.brand)} - \${escapeHtml(t.name)}</strong> (\${escapeHtml(t.year) || 'N/A'}, \${escapeHtml(t.vote_count)} votes)
            </div>
            <div style="font-size: 12px; color: var(--mu);">ID: \${escapeHtml(t.id)}</div>
          </div>
          <div class="side-by-side">
            <!-- Target Fragrance Info -->
            <div class="target-col">
              <div class="target-image-wrap">
                <img src="\${escapeHtml(targetImg)}" alt="\${escapeHtml(t.name)}" onerror="this.src='\${placeholderSvg}'" />
              </div>
              <div>
                <div class="target-brand">\${escapeHtml(t.brand)}</div>
                <div class="target-name">\${escapeHtml(t.name)}</div>
                <div class="target-meta">\${escapeHtml(t.gender)} &bull; \${escapeHtml(t.year) || 'Year unknown'} &bull; \${escapeHtml(t.vote_count)} votes</div>
              </div>
              <div class="target-notes-box">
                <div style="font-weight: 600; margin-bottom: 2px;">Target Notes:</div>
                <div style="color: var(--mu);">\${escapeHtml(t.notes) || 'No pyramid notes'}</div>
              </div>
            </div>

            <!-- Content-Only Recommendations -->
            <div class="rec-col">
              <div class="rec-col-title">
                <span>Content-Only (Public DB)</span>
                <span style="font-size: 11px; font-weight: 500; color: var(--mu);">Zero Scraping Graph</span>
              </div>
              <div class="rec-list">
                \${item.contentItems.map(r => \`
                  <div class="rec-item">
                    <span class="rec-rank">#\${escapeHtml(r.rank)}</span>
                    <img class="rec-thumb" src="\${escapeHtml(r.image_url || placeholderSvg)}" onerror="this.src='\${placeholderSvg}'" />
                    <div class="rec-info">
                      <div class="rec-brand">\${escapeHtml(r.brand)}</div>
                      <div class="rec-name" title="\${escapeHtml(r.name)}">\${escapeHtml(r.name)}</div>
                      <div class="rec-label">\${escapeHtml(r.label)}</div>
                    </div>
                  </div>
                \`).join('')}
              </div>
              <div class="rating-section">
                <div class="btn-group" id="content-btns-\${t.id}">
                  <button class="btn-rate good \${contentRating === 'good' ? 'active' : ''}" data-rate="good" onclick="setRating(\${t.id}, 'content', 'good')">Good</button>
                  <button class="btn-rate ok \${contentRating === 'ok' ? 'active' : ''}" data-rate="ok" onclick="setRating(\${t.id}, 'content', 'ok')">OK</button>
                  <button class="btn-rate bad \${contentRating === 'bad' ? 'active' : ''}" data-rate="bad" onclick="setRating(\${t.id}, 'content', 'bad')">Bad</button>
                </div>
                <input class="comment-input" type="text" placeholder="Content feedback / comments..." value="\${escapeHtml(contentComment)}" oninput="setComment(\${t.id}, 'content', this.value)" />
              </div>
            </div>

            <!-- Hybrid Recommendations -->
            <div class="rec-col">
              <div class="rec-col-title">
                <span>Hybrid Engine (Full DB)</span>
                <span style="font-size: 11px; font-weight: 500; color: var(--mu);">Community + Fallback</span>
              </div>
              <div class="rec-list">
                \${item.hybridItems.map(r => \`
                  <div class="rec-item">
                    <span class="rec-rank">#\${escapeHtml(r.rank)}</span>
                    <img class="rec-thumb" src="\${escapeHtml(r.image_url || placeholderSvg)}" onerror="this.src='\${placeholderSvg}'" />
                    <div class="rec-info">
                      <div class="rec-brand">\${escapeHtml(r.brand)}</div>
                      <div class="rec-name" title="\${escapeHtml(r.name)}">\${escapeHtml(r.name)}</div>
                      <div class="rec-label">\${escapeHtml(r.label)}</div>
                    </div>
                  </div>
                \`).join('')}
              </div>
              <div class="rating-section">
                <div class="btn-group" id="hybrid-btns-\${t.id}">
                  <button class="btn-rate good \${hybridRating === 'good' ? 'active' : ''}" data-rate="good" onclick="setRating(\${t.id}, 'hybrid', 'good')">Good</button>
                  <button class="btn-rate ok \${hybridRating === 'ok' ? 'active' : ''}" data-rate="ok" onclick="setRating(\${t.id}, 'hybrid', 'ok')">OK</button>
                  <button class="btn-rate bad \${hybridRating === 'bad' ? 'active' : ''}" data-rate="bad" onclick="setRating(\${t.id}, 'hybrid', 'bad')">Bad</button>
                </div>
                <input class="comment-input" type="text" placeholder="Hybrid feedback / comments..." value="\${escapeHtml(hybridComment)}" oninput="setComment(\${t.id}, 'hybrid', this.value)" />
              </div>
            </div>
          </div>
        \`;

        grid.appendChild(card);
      });

      updateStats();
    }

    function filterCards(stratum) {
      document.querySelectorAll(".filter-btn").forEach(b => {
        b.classList.remove("active");
        if (b.dataset.stratum === stratum) b.classList.add("active");
      });
      renderCards(stratum);
    }

    function exportRatings() {
      const payload = {
        schema_version: "1.0.0",
        git_commit: GIT_COMMIT,
        exported_at: new Date().toISOString(),
        total_fragrances: data.length,
        target_ids: data.map(d => d.target.id),
        ratings: state
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "raphragrance-similarity-review.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function importRatings(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const parsed = JSON.parse(e.target.result);
          if (parsed && parsed.ratings) {
            state = Object.assign({}, state, parsed.ratings);
            saveState();
            renderCards('all');
            alert("Successfully imported ratings from " + file.name);
          } else {
            alert("Invalid rating file: missing 'ratings' object.");
          }
        } catch (err) {
          alert("Error parsing JSON file: " + err.message);
        }
      };
      reader.readAsText(file);
    }

    renderCards('all');
  </script>
</body>
</html>
`;

fs.writeFileSync('reports/similar-review.html', html, 'utf8');
console.log('✓ Successfully generated reports/similar-review.html (self-contained review interface)');
fullDb.close();
publicDb.close();
