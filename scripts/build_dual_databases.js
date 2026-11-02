const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');

function buildDualDatabases() {
  console.log('=== BUILDING DUAL DATABASE ARTIFACTS ===\n');

  const mainDbPath = 'data/perfumes.db';
  if (!fs.existsSync(mainDbPath)) {
    throw new Error('data/perfumes.db not found!');
  }

  const mainDb = new DatabaseSync(mainDbPath);

  // 1. Validate and load curated overrides via canonical loader
  console.log('Step 1: Validating data/similar_overrides.csv...');
  const { parseAndValidateCuratedOverrides } = require('../lib/curated_loader');
  const csvContent = fs.readFileSync('data/similar_overrides.csv', 'utf8');
  const slugToIdStmt = mainDb.prepare('SELECT id, name, brand FROM perfumes WHERE slug = ?');
  const overrides = parseAndValidateCuratedOverrides(csvContent, slug => slugToIdStmt.get(slug));

  for (const o of overrides) {
    console.log(`  ✓ Validated override: ${o.slugA} <-> ${o.slugB} (${o.strength}, ${o.note})`);
  }

  // 2. Prepare curated insert pairs (bidirectional)
  const curatedByFragrance = new Map();
  for (const o of overrides) {
    if (!curatedByFragrance.has(o.idA)) curatedByFragrance.set(o.idA, []);
    curatedByFragrance.get(o.idA).push({ targetId: o.idB, score: o.strength * 1000 });

    if (!curatedByFragrance.has(o.idB)) curatedByFragrance.set(o.idB, []);
    curatedByFragrance.get(o.idB).push({ targetId: o.idA, score: o.strength * 1000 });
  }

  // 3. Create data/perfumes.public.db
  console.log('\nStep 2: Generating data/perfumes.public.db (strictly content + curated, NO community data)...');
  const publicDbPath = 'data/perfumes.public.db';
  if (fs.existsSync(publicDbPath)) fs.unlinkSync(publicDbPath);

  const publicDb = new DatabaseSync(publicDbPath);
  publicDb.exec(`
    ATTACH DATABASE '${mainDbPath}' AS mainDb;
    CREATE TABLE perfumes AS SELECT * FROM mainDb.perfumes;
    CREATE UNIQUE INDEX idx_perfumes_id ON perfumes(id);
    CREATE INDEX idx_perfumes_slug ON perfumes(slug);
    CREATE INDEX idx_perfumes_brand ON perfumes(brand);
    CREATE INDEX idx_perfumes_votes ON perfumes(vote_count DESC);

    CREATE TABLE similar (
      fragrance_id INTEGER NOT NULL,
      similar_id INTEGER NOT NULL,
      rank INTEGER NOT NULL,
      score REAL NOT NULL,
      source TEXT NOT NULL,
      PRIMARY KEY (fragrance_id, source, rank)
    );

    -- Copy strictly content rows
    INSERT INTO similar (fragrance_id, similar_id, rank, score, source)
    SELECT fragrance_id, similar_id, rank, score, 'content'
    FROM mainDb.similar
    WHERE source = 'content';

    DETACH DATABASE mainDb;
  `);

  // Insert curated rows into publicDb
  const insertPublicCurated = publicDb.prepare(`
    INSERT INTO similar (fragrance_id, similar_id, rank, score, source)
    VALUES (?, ?, ?, ?, 'curated')
  `);

  publicDb.exec('BEGIN TRANSACTION');
  let curatedInserted = 0;
  for (const [fid, targets] of curatedByFragrance) {
    targets.forEach((t, idx) => {
      insertPublicCurated.run(fid, t.targetId, idx + 1, t.score);
      curatedInserted++;
    });
  }
  publicDb.exec('COMMIT');

  publicDb.exec(`
    CREATE INDEX idx_similar_lookup ON similar(fragrance_id, source, rank);
    CREATE INDEX idx_similar_rank ON similar(fragrance_id, rank);
  `);

  const publicCommCount = publicDb.prepare("SELECT COUNT(*) as c FROM similar WHERE source = 'community'").get().c;
  const publicContentCount = publicDb.prepare("SELECT COUNT(*) as c FROM similar WHERE source = 'content'").get().c;
  const publicCuratedCount = publicDb.prepare("SELECT COUNT(*) as c FROM similar WHERE source = 'curated'").get().c;
  console.log(`  Public DB populated:`);
  console.log(`    Content rows:   ${publicContentCount}`);
  console.log(`    Curated rows:   ${publicCuratedCount}`);
  console.log(`    Community rows: ${publicCommCount} (Must be exactly 0)`);
  if (publicCommCount !== 0) throw new Error('SAFETY BREACH: Community rows found in public database!');

  publicDb.close();

  // 4. Create data/perfumes.full.db
  console.log('\nStep 3: Generating data/perfumes.full.db (hybrid: content + community + curated)...');
  const fullDbPath = 'data/perfumes.full.db';
  if (fs.existsSync(fullDbPath)) fs.unlinkSync(fullDbPath);

  const fullDb = new DatabaseSync(fullDbPath);
  fullDb.exec(`
    ATTACH DATABASE '${mainDbPath}' AS mainDb;
    CREATE TABLE perfumes AS SELECT * FROM mainDb.perfumes;
    CREATE UNIQUE INDEX idx_perfumes_id ON perfumes(id);
    CREATE INDEX idx_perfumes_slug ON perfumes(slug);
    CREATE INDEX idx_perfumes_brand ON perfumes(brand);
    CREATE INDEX idx_perfumes_votes ON perfumes(vote_count DESC);

    CREATE TABLE similar (
      fragrance_id INTEGER NOT NULL,
      similar_id INTEGER NOT NULL,
      rank INTEGER NOT NULL,
      score REAL NOT NULL,
      source TEXT NOT NULL,
      PRIMARY KEY (fragrance_id, source, rank)
    );

    INSERT INTO similar (fragrance_id, similar_id, rank, score, source)
    SELECT fragrance_id, similar_id, rank, score, source
    FROM mainDb.similar;

    DETACH DATABASE mainDb;
  `);

  // Insert curated rows into fullDb
  const insertFullCurated = fullDb.prepare(`
    INSERT INTO similar (fragrance_id, similar_id, rank, score, source)
    VALUES (?, ?, ?, ?, 'curated')
  `);

  fullDb.exec('BEGIN TRANSACTION');
  for (const [fid, targets] of curatedByFragrance) {
    targets.forEach((t, idx) => {
      insertFullCurated.run(fid, t.targetId, idx + 1, t.score);
    });
  }
  fullDb.exec('COMMIT');

  fullDb.exec(`
    CREATE INDEX idx_similar_lookup ON similar(fragrance_id, source, rank);
    CREATE INDEX idx_similar_rank ON similar(fragrance_id, rank);
  `);

  const fullCommCount = fullDb.prepare("SELECT COUNT(*) as c FROM similar WHERE source = 'community'").get().c;
  const fullContentCount = fullDb.prepare("SELECT COUNT(*) as c FROM similar WHERE source = 'content'").get().c;
  const fullCuratedCount = fullDb.prepare("SELECT COUNT(*) as c FROM similar WHERE source = 'curated'").get().c;
  console.log(`  Full DB populated:`);
  console.log(`    Content rows:   ${fullContentCount}`);
  console.log(`    Community rows: ${fullCommCount}`);
  console.log(`    Curated rows:   ${fullCuratedCount}`);

  fullDb.close();
  mainDb.close();

  console.log('\n✓ Dual databases successfully built and verified.');
}

buildDualDatabases();
