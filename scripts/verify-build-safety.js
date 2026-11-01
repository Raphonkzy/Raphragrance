#!/usr/bin/env node
/**
 * scripts/verify-build-safety.js
 * Ensures prohibited raw scraping files (e.g. *.jsonl, raw edges)
 * are not present in the workspace or Docker build context.
 */

const fs = require('fs');
const path = require('path');

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

console.log('✓ Build safety check passed: No prohibited raw dataset files in build context.');
process.exit(0);
