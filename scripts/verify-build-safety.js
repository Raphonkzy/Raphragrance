#!/usr/bin/env node
/**
 * scripts/verify-build-safety.js
 * Ensures prohibited raw scraping files (e.g. *.jsonl, raw edges)
 * are not present in the workspace or Docker build context.
 * Strictly verifies that perfumes.public.db contains ZERO community rows or edge tables.
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const rootDir = path.resolve(__dirname, '..');

// Prohibited patterns in repository root and subdirectories
const prohibitedExtensions = ['.jsonl', '.dump'];
const prohibitedFilenames = ['perfumes.jsonl', 'edges.json', 'raw_edges.db'];

function scanDirectory(dir, depth = 0) {
  if (depth > 3) return [];
  let violations = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      violations = violations.concat(scanDirectory(fullPath, depth + 1));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (prohibitedExtensions.includes(ext) || prohibitedFilenames.includes(entry.name.toLowerCase())) {
        violations.push(fullPath);
      }
    }
  }
  return violations;
}

const foundViolations = scanDirectory(rootDir);

if (foundViolations.length > 0) {
  console.error('\n[BUILD SAFETY ERROR] Prohibited raw dataset files detected in workspace:');
  foundViolations.forEach(v => console.error(`  - ${v}`));
  console.error('\nRaw scraped files (*.jsonl, raw edge dumps) must NEVER be included in build context or production images.');
  console.error('Please remove or move them to an external directory before building.\n');
  process.exit(1);
}

// Verify data/perfumes.public.db integrity if present
const publicDbPath = path.join(rootDir, 'data', 'perfumes.public.db');
if (fs.existsSync(publicDbPath)) {
  const db = new DatabaseSync(publicDbPath, { open: true, readOnly: true });

  // 1. Ensure no edge tables or also_liked tables exist
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name);
  const prohibitedTables = tables.filter(t => /edge|community|also_liked|votes/i.test(t));
  if (prohibitedTables.length > 0) {
    console.error(`\n[BUILD SAFETY ERROR] Prohibited edge tables detected in perfumes.public.db: ${prohibitedTables.join(', ')}`);
    process.exit(1);
  }

  // 2. Ensure ZERO community rows in similar table
  const commRows = db.prepare("SELECT COUNT(*) as c FROM similar WHERE source = 'community'").get().c;
  if (commRows > 0) {
    console.error(`\n[BUILD SAFETY ERROR] data/perfumes.public.db contains ${commRows} prohibited community rows!`);
    console.error('Public distribution artifact must contain strictly content and curated rows.');
    process.exit(1);
  }

  // 3. Ensure no prohibited raw columns in perfumes
  const columns = db.prepare("PRAGMA table_info(perfumes)").all().map(c => c.name);
  const prohibitedCols = columns.filter(c => /also_liked|edges|raw|ai_summary|reminds_me_of/i.test(c));
  if (prohibitedCols.length > 0) {
    console.error(`\n[BUILD SAFETY ERROR] Prohibited columns in perfumes table: ${prohibitedCols.join(', ')}`);
    process.exit(1);
  }

  // 4. Ensure index on perfumes(id) exists to prevent 2.3s JOIN full-table scans
  const indices = db.prepare("PRAGMA index_list('perfumes')").all().map(idx => idx.name);
  if (!indices.includes('idx_perfumes_id')) {
    console.error('\n[BUILD SAFETY ERROR] Missing critical index idx_perfumes_id! HTTP queries will suffer full-table scans.');
    process.exit(1);
  }

  // 5. Validate data/similar_overrides.csv loader rules (Gate 2.3)
  const overridesPath = path.join(rootDir, 'data', 'similar_overrides.csv');
  if (fs.existsSync(overridesPath)) {
    const { parseAndValidateCuratedOverrides } = require('../lib/curated_loader');
    const csvContent = fs.readFileSync(overridesPath, 'utf8');
    const slugStmt = db.prepare('SELECT id, name, brand FROM perfumes WHERE slug = ?');
    try {
      const parsed = parseAndValidateCuratedOverrides(csvContent, slug => slugStmt.get(slug));
      console.log(`✓ Curated overrides validated: ${parsed.length} pairs conform to all safety rules.`);
    } catch (err) {
      console.error(`\n[BUILD SAFETY ERROR] Curated overrides validation failed: ${err.message}`);
      process.exit(1);
    }
  }

  db.close();
  console.log('✓ Public database safety verified: 0 community rows, 0 edge tables, critical indices present.');
}

// 5. Verify HTTP Latency Benchmark (fail if p95 > 20 ms)
const latencyReportPath = path.join(rootDir, 'reports', 'http_latency_results.json');
if (fs.existsSync(latencyReportPath)) {
  const latencyData = JSON.parse(fs.readFileSync(latencyReportPath, 'utf8'));
  const contentP95 = latencyData.contentResults?.p95;
  const hybridP95 = latencyData.hybridResults?.p95;

  if (typeof contentP95 !== 'number' || contentP95 > 20) {
    console.error(`\n[LATENCY BENCHMARK FAILURE] Content-Only HTTP p95 latency is ${contentP95}ms (> 20ms threshold)!`);
    process.exit(1);
  }
  if (typeof hybridP95 !== 'number' || hybridP95 > 20) {
    console.error(`\n[LATENCY BENCHMARK FAILURE] Hybrid HTTP p95 latency is ${hybridP95}ms (> 20ms threshold)!`);
    process.exit(1);
  }
  console.log(`✓ HTTP Latency Benchmark verified: Content p95 = ${contentP95}ms, Hybrid p95 = ${hybridP95}ms (both <= 20ms).`);
} else {
  console.warn('⚠️ Warning: reports/http_latency_results.json not found during build check.');
}

console.log('✓ Build safety check passed: No prohibited raw dataset files in build context.');
process.exit(0);
