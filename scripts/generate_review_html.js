const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const publicDb = new DatabaseSync('data/perfumes.public.db');
const fullDb = new DatabaseSync('data/perfumes.full.db');

// Seeded PRNG for deterministic stratified sampling
function makePrng(seed = 12345) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    state = (s * 16807) % 2147483647;
    s = state;
    return (state - 1) / 2147483646;
  };
}
const rng = makePrng(999);

const namedIds = [
  9828,   // Aventus
  31861,  // Sauvage
  33519,  // Baccarat Rouge 540
  12201,  // Santal 33
  1825,   // Tobacco Vanille
  43871,  // Delina
  39314,  // Layton
  51411,  // Lost Cherry
  62615,  // Angels' Share
  50757,  // Y Eau de Parfum
  68271,  // Supremacy Not Only Intense
  108244, // Turathi Electric
  84224   // Blue Talisman
];

const namedSet = new Set(namedIds);

// Stratified sampling (8 each)
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

// 1. Add Named Anchors
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

const stmtPublicContent = publicDb.prepare(`
  SELECT s.similar_id, s.score, s.source, p.*
  FROM similar s
  JOIN perfumes p ON p.id = s.similar_id
  WHERE s.fragrance_id = ?
  ORDER BY s.rank ASC
  LIMIT 10
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
  LIMIT 10
`);

const stmtFullContent = fullDb.prepare(`
  SELECT s.similar_id, s.score, s.source, p.*
  FROM similar s
  JOIN perfumes p ON p.id = s.similar_id
  WHERE s.fragrance_id = ? AND s.source = 'content'
  ORDER BY s.rank ASC
  LIMIT 20
`);

function getTargetPackage(target) {
  const targetNotes = parseNotes(target);

  // Content list (Public DB)
  const contentRaw = stmtPublicContent.all(target.id);
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

  // Hybrid list (Full DB)
  const hybridRaw = [];
  const seenIds = new Set([target.id]);

  for (const r of stmtFullCurated.all(target.id)) {
    if (!seenIds.has(r.id)) { hybridRaw.push(r); seenIds.add(r.id); }
    if (hybridRaw.length >= 10) break;
  }
  if (hybridRaw.length < 10) {
    for (const r of stmtFullCommunity.all(target.id)) {
      if (!seenIds.has(r.id)) { hybridRaw.push(r); seenIds.add(r.id); }
      if (hybridRaw.length >= 10) break;
    }
  }
  if (hybridRaw.length < 10) {
    for (const r of stmtFullContent.all(target.id)) {
      if (!seenIds.has(r.id)) { hybridRaw.push(r); seenIds.add(r.id); }
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
      accords: target.accords,
      notes: targetNotes.slice(0, 8).join(', '),
      image_url: target.image_url
    },
    contentItems,
    hybridItems
  };
}

const packagedData = targets.map(getTargetPackage);

// Generate self-contained HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Raphragrance Similarity Engine - Human Review Interface</title>
  <style>
    :root {
      --bg: #FBFBFA;
      --card-bg: #FFFFFF;
      --border: #E8E8E4;
      --text: #191918;
      --mu: #5F5F5A;
      --accent: #B24E2B;
      --green: #2E7D32;
      --amber: #ED6C02;
      --red: #D32F2F;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0C0C0C;
        --card-bg: #141414;
        --border: #262626;
        --text: #F2F2F0;
        --mu: #9A9A95;
        --accent: #E07A5F;
        --green: #4CAF50;
        --amber: #FFB74D;
        --red: #EF5350;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
      padding: 24px;
    }
    .container { max-width: 1540px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }
    h1 { font-size: 24px; font-weight: 700; }
    .subtitle { color: var(--mu); font-size: 14px; margin-top: 4px; }
    .header-actions { display: flex; gap: 12px; align-items: center; }
    button.export-btn {
      background: var(--accent);
      color: #fff;
      border: none;
      padding: 10px 18px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    button.export-btn:hover { opacity: 0.9; }
    .filters {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .filter-btn {
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      cursor: pointer;
      font-weight: 500;
    }
    .filter-btn.active {
      background: var(--text);
      color: var(--bg);
      border-color: var(--text);
    }
    .review-grid {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }
    .fragrance-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .stratum-tag {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 3px 8px;
      border-radius: 4px;
      background: var(--border);
      color: var(--mu);
      font-weight: 600;
    }
    .side-by-side {
      display: grid;
      grid-template-columns: 300px 1fr 1fr;
      gap: 24px;
    }
    @media (max-width: 1200px) {
      .side-by-side { grid-template-columns: 1fr; }
    }
    .target-col {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .target-image-wrap {
      width: 100%;
      height: 240px;
      background: var(--bg);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    .target-image-wrap img {
      max-height: 90%;
      max-width: 90%;
      object-fit: contain;
    }
    .target-brand { font-size: 13px; text-transform: uppercase; color: var(--mu); font-weight: 600; }
    .target-name { font-size: 18px; font-weight: 700; margin-top: 2px; }
    .target-meta { font-size: 12px; color: var(--mu); margin-top: 4px; }
    .target-notes-box {
      font-size: 12px;
      background: var(--bg);
      padding: 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
    }
    .rec-col {
      background: var(--bg);
      border-radius: 10px;
      padding: 16px;
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
    }
    .rec-col-title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .rec-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
    }
    .rec-item {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 12px;
    }
    .rec-rank {
      font-size: 12px;
      font-weight: 700;
      color: var(--mu);
      min-width: 24px;
    }
    .rec-thumb {
      width: 44px;
      height: 44px;
      background: var(--bg);
      border-radius: 4px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .rec-info {
      flex: 1;
      min-width: 0;
    }
    .rec-brand { font-size: 11px; text-transform: uppercase; color: var(--mu); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rec-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rec-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--mu);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rating-section {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }
    .btn-group {
      display: flex;
      gap: 6px;
      margin-bottom: 8px;
    }
    .btn-rate {
      flex: 1;
      padding: 6px;
      border-radius: 5px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
    }
    .btn-rate.good.active { background: var(--green); color: #fff; border-color: var(--green); }
    .btn-rate.ok.active { background: var(--amber); color: #fff; border-color: var(--amber); }
    .btn-rate.bad.active { background: var(--red); color: #fff; border-color: var(--red); }
    .comment-input {
      width: 100%;
      padding: 8px 10px;
      font-size: 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--card-bg);
      color: var(--text);
    }
    .stats-bar {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 18px;
      margin-bottom: 24px;
      display: flex;
      gap: 24px;
      font-size: 13px;
      color: var(--mu);
    }
    .stats-bar strong { color: var(--text); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Similarity Engine - Human Review Interface</h1>
        <div class="subtitle">Blind/Side-by-side verification: Content-Only (Public DB) vs Hybrid Mode (Full DB) across 53 Stratified Fragrances</div>
      </div>
      <div class="header-actions">
        <button class="export-btn" onclick="exportRatings()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export Ratings (JSON)
        </button>
      </div>
    </header>

    <div class="stats-bar">
      <div>Total Fragrances: <strong id="stat-total">53</strong></div>
      <div>Rated Content-Only: <strong id="stat-content-rated">0</strong> / 53</div>
      <div>Rated Hybrid: <strong id="stat-hybrid-rated">0</strong> / 53</div>
      <div>Status: <span id="save-status" style="color: var(--green); font-weight: 600;">Saved locally</span></div>
    </div>

    <div class="filters">
      <button class="filter-btn active" onclick="filterCards('all')">All (53)</button>
      <button class="filter-btn" onclick="filterCards('Named Anchor')">Named Anchors (13)</button>
      <button class="filter-btn" onclick="filterCards('Popular')">Popular (8)</button>
      <button class="filter-btn" onclick="filterCards('Mid')">Mid (8)</button>
      <button class="filter-btn" onclick="filterCards('Long-Tail')">Long-Tail (8)</button>
      <button class="filter-btn" onclick="filterCards('Clone Houses')">Clone Houses (8)</button>
      <button class="filter-btn" onclick="filterCards('Flat-Only Notes')">Flat-Only Notes (8)</button>
    </div>

    <div class="review-grid" id="grid">
      <!-- Cards rendered here -->
    </div>
  </div>

  <script>
    const data = ${JSON.stringify(packagedData)};
    const STORAGE_KEY = "raphragrance_similarity_review_v1";

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
              <span class="stratum-tag">\${t.stratum}</span>
              <strong style="margin-left: 8px;">\${t.brand} - \${t.name}</strong> (\${t.year || 'N/A'}, \${t.vote_count} votes)
            </div>
            <div style="font-size: 12px; color: var(--mu);">ID: \${t.id}</div>
          </div>
          <div class="side-by-side">
            <!-- Target Fragrance Info -->
            <div class="target-col">
              <div class="target-image-wrap">
                <img src="\${targetImg}" alt="\${t.name}" onerror="this.src='\${placeholderSvg}'" />
              </div>
              <div>
                <div class="target-brand">\${t.brand}</div>
                <div class="target-name">\${t.name}</div>
                <div class="target-meta">\${t.gender} &bull; \${t.year || 'Year unknown'} &bull; \${t.vote_count} votes</div>
              </div>
              <div class="target-notes-box">
                <div style="font-weight: 600; margin-bottom: 2px;">Target Notes:</div>
                <div style="color: var(--mu);">\${t.notes || 'No pyramid notes'}</div>
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
                    <span class="rec-rank">#\${r.rank}</span>
                    <img class="rec-thumb" src="\${r.image_url || placeholderSvg}" onerror="this.src='\${placeholderSvg}'" />
                    <div class="rec-info">
                      <div class="rec-brand">\${r.brand}</div>
                      <div class="rec-name" title="\${r.name}">\${r.name}</div>
                      <div class="rec-label">\${r.label}</div>
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
                <input class="comment-input" type="text" placeholder="Content feedback / comments..." value="\${contentComment.replace(/"/g, '&quot;')}" oninput="setComment(\${t.id}, 'content', this.value)" />
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
                    <span class="rec-rank">#\${r.rank}</span>
                    <img class="rec-thumb" src="\${r.image_url || placeholderSvg}" onerror="this.src='\${placeholderSvg}'" />
                    <div class="rec-info">
                      <div class="rec-brand">\${r.brand}</div>
                      <div class="rec-name" title="\${r.name}">\${r.name}</div>
                      <div class="rec-label">\${r.label}</div>
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
                <input class="comment-input" type="text" placeholder="Hybrid feedback / comments..." value="\${hybridComment.replace(/"/g, '&quot;')}" oninput="setComment(\${t.id}, 'hybrid', this.value)" />
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
        if (b.textContent.toLowerCase().includes(stratum.toLowerCase())) b.classList.add("active");
      });
      renderCards(stratum);
    }

    function exportRatings() {
      const payload = {
        exported_at: new Date().toISOString(),
        total_fragrances: data.length,
        ratings: state
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "aphragrance-similarity-review.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    renderCards('all');
  </script>
</body>
</html>
`;

fs.writeFileSync('reports/similar-review.html', html, 'utf8');
console.log('✓ Successfully generated reports/similar-review.html (self-contained review interface)');
