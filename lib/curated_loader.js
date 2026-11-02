const fs = require('fs');

/**
 * Validates and parses curated similarity overrides CSV.
 * 
 * @param {string} csvContent Raw CSV text
 * @param {(slug: string) => { id: number, name: string, brand: string } | null} slugLookup Function to check slug existence
 * @returns {Array<{ idA: number, idB: number, slugA: string, slugB: string, strength: number, note: string }>}
 */
function parseAndValidateCuratedOverrides(csvContent, slugLookup) {
  if (!csvContent || typeof csvContent !== 'string') {
    throw new Error('Malformed CSV: empty or invalid content');
  }

  const lines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    throw new Error('Malformed CSV: file has no content');
  }

  const header = lines[0].split(',').map(s => s.trim());
  if (header.length < 4 || header[0] !== 'a_slug' || header[1] !== 'b_slug' || header[2] !== 'strength' || header[3] !== 'note') {
    throw new Error('Invalid CSV header: expected "a_slug,b_slug,strength,note"');
  }

  const overrides = [];
  const seenPairs = new Set();

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const parts = line.split(',');

    if (parts.length < 4) {
      throw new Error(`Malformed row at line ${lineNum}: expected at least 4 comma-separated values ("${line}")`);
    }

    const a_slug = parts[0].trim();
    const b_slug = parts[1].trim();
    const strengthStr = parts[2].trim();
    const note = parts.slice(3).join(',').trim();

    if (!a_slug || !b_slug) {
      throw new Error(`Malformed row at line ${lineNum}: empty slug detected ("${line}")`);
    }

    if (a_slug === b_slug) {
      throw new Error(`Self pair violation at line ${lineNum}: a_slug cannot equal b_slug ("${a_slug}")`);
    }

    const strength = Number(strengthStr);
    if (isNaN(strength) || strength < 0.0 || strength > 1.0) {
      throw new Error(`Strength outside range [0.0, 1.0] at line ${lineNum}: got ${strengthStr}`);
    }

    // Duplicate check (both direct and reverse)
    const forwardKey = `${a_slug}<->${b_slug}`;
    const reverseKey = `${b_slug}<->${a_slug}`;
    if (seenPairs.has(forwardKey) || seenPairs.has(reverseKey)) {
      throw new Error(`Duplicate pair violation at line ${lineNum}: pair already defined ("${a_slug}" <-> "${b_slug}")`);
    }
    seenPairs.add(forwardKey);

    // Slug existence check via lookup function
    if (typeof slugLookup === 'function') {
      const rowA = slugLookup(a_slug);
      if (!rowA) {
        throw new Error(`Unknown slug at line ${lineNum}: "${a_slug}" does not exist in perfumes database`);
      }
      const rowB = slugLookup(b_slug);
      if (!rowB) {
        throw new Error(`Unknown slug at line ${lineNum}: "${b_slug}" does not exist in perfumes database`);
      }
      overrides.push({
        idA: rowA.id,
        idB: rowB.id,
        slugA: a_slug,
        slugB: b_slug,
        strength,
        note
      });
    } else {
      overrides.push({
        idA: 0,
        idB: 0,
        slugA: a_slug,
        slugB: b_slug,
        strength,
        note
      });
    }
  }

  return overrides;
}

module.exports = {
  parseAndValidateCuratedOverrides
};
