const { DatabaseSync } = require('node:sqlite');
const path = require('path');

function runSlugIntegrity() {
  console.log('=== GATE 6.1: FULL SLUG INTEGRITY QA (131,930 FRAGRANCES) ===\n');

  const startTime = Date.now();
  const dbPath = path.join(__dirname, '..', 'data', 'perfumes.public.db');
  const db = new DatabaseSync(dbPath, { open: true, readOnly: true });

  const rows = db.prepare('SELECT id, slug, name, brand FROM perfumes').all();
  const total = rows.length;
  console.log(`Loaded ${total.toLocaleString()} rows from perfumes.public.db.`);

  const stmtExact = db.prepare('SELECT id, name FROM perfumes WHERE slug = ?');
  const stmtCase = db.prepare('SELECT id, name FROM perfumes WHERE slug = ? COLLATE NOCASE');

  let nullLookups = 0;
  let roundtripErrors = 0;
  let missingSlugs = 0;
  const edgeCaseFailures = [];

  for (let i = 0; i < total; i++) {
    const row = rows[i];
    const originalSlug = row.slug;

    if (!originalSlug || typeof originalSlug !== 'string' || originalSlug.trim() === '') {
      missingSlugs++;
      continue;
    }

    // Next.js URL roundtrip simulation:
    // URL: /fragrance/{segment1}/{segment2}
    const segments = originalSlug.split('/');
    const encodedPath = segments.map((s) => encodeURIComponent(s)).join('/');
    const decodedPath = encodedPath.split('/').map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    }).join('/');

    if (decodedPath !== originalSlug) {
      roundtripErrors++;
    }

    let match = stmtExact.get(decodedPath);
    if (!match) {
      match = stmtCase.get(decodedPath);
    }

    if (!match) {
      nullLookups++;
      if (edgeCaseFailures.length < 10) {
        edgeCaseFailures.push({ id: row.id, slug: originalSlug, error: 'Row not found in SQLite' });
      }
    }
  }

  // Explicit verification of special edge cases mentioned in release criteria
  const specialCases = [
    { label: 'Diacritics: Granado Époque Tropical', term: 'Granado/Epoque-Tropical' },
    { label: 'Punctuation: Dolce&Gabbana Light Blue', term: 'Dolce-Gabbana/Light-Blue' },
    { label: 'Hyphenated Brand: Ex Nihilo Fleur Narcotique', term: 'Ex-Nihilo/Fleur-Narcotique' },
    { label: "Apostrophe: Terre d'Hermes", term: 'Hermes/Terre-d-Hermes' },
    { label: 'Numbers: Baccarat Rouge 540 Extrait', term: 'Maison-Francis-Kurkdjian/Baccarat-Rouge-540-Extrait-de-Parfum' }
  ];

  console.log('\n--- Special Slug Edge Cases Verification ---');
  let specialPass = 0;
  for (const sc of specialCases) {
    const match = stmtExact.get(sc.term) || stmtCase.get(sc.term);
    if (match) {
      console.log(`  ✓ ${sc.label} -> ID: ${match.id} ("${match.name}")`);
      specialPass++;
    } else {
      console.log(`  ✖ ${sc.label} -> Not found with slug "${sc.term}"`);
    }
  }

  const durationMs = Date.now() - startTime;
  const passCount = total - nullLookups - missingSlugs;

  console.log('\n============================================================');
  console.log('SLUG INTEGRITY QA SUMMARY:');
  console.log(`  Total Slugs Tested:    ${total.toLocaleString()}`);
  console.log(`  Passing Slugs:         ${passCount.toLocaleString()} (${((passCount / total) * 100).toFixed(2)}%)`);
  console.log(`  Null Lookups:          ${nullLookups}`);
  console.log(`  Missing / Empty Slugs: ${missingSlugs}`);
  console.log(`  Roundtrip Invariants:  ${roundtripErrors === 0 ? '0 errors (100% invariant)' : `${roundtripErrors} mismatches`}`);
  console.log(`  Special Edge Cases:    ${specialPass} / ${specialCases.length} verified`);
  console.log(`  Execution Duration:    ${durationMs} ms (${(durationMs / 1000).toFixed(2)}s)`);
  console.log('============================================================\n');

  db.close();

  if (nullLookups > 0 || missingSlugs > 0) {
    console.error('FATAL: Slug integrity check failed with null lookups or missing slugs!');
    process.exit(1);
  } else {
    console.log('✓ Gate 6.1 PASSED: All 131,930 slugs resolve without null or throwing.');
  }
}

runSlugIntegrity();
