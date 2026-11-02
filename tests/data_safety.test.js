const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

describe('Data Safety & Fail-Closed Gate 3.1 & 3.2', () => {
  it('Gate 3.1(a): Public database contains strictly 0 community rows and no edge tables', () => {
    const publicDbPath = path.join(process.cwd(), 'data', 'perfumes.public.db');
    assert.ok(fs.existsSync(publicDbPath), 'perfumes.public.db must exist');

    const db = new DatabaseSync(publicDbPath, { open: true, readOnly: true });
    const commRows = db.prepare("SELECT COUNT(*) as c FROM similar WHERE source = 'community'").get().c;
    assert.equal(commRows, 0, 'Public DB must contain exactly 0 community rows');

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name);
    const prohibitedTables = tables.filter(t => /edge|community|also_liked|votes/i.test(t));
    assert.equal(prohibitedTables.length, 0, 'Public DB must not contain prohibited edge tables');
    db.close();
  });

  it('Gate 3.1(b): INCLUDE_COMMUNITY_EDGES=true throws hard error when full db is missing', () => {
    const { spawnSync } = require('child_process');
    const code = `
      process.env.INCLUDE_COMMUNITY_EDGES = 'true';
      const fs = require('fs');
      const orig = fs.existsSync;
      fs.existsSync = (p) => p.includes('perfumes.full.db') ? false : orig(p);
      const { getDb } = require('./lib/db.ts');
      getDb();
    `;

    const res = spawnSync(process.execPath, ['--experimental-strip-types', '-e', code], { encoding: 'utf8' });
    assert.equal(res.status, 1, 'Process should fail with exit code 1');
    assert.match(
      res.stderr,
      /INCLUDE_COMMUNITY_EDGES=true was requested, but 'data\/perfumes.full.db' does not exist/
    );
  });

  it('Gate 3.1(c): INCLUDE_COMMUNITY_EDGES=true in production throws error without ALLOW_FULL_DB_IN_PROD=true', () => {
    const { spawnSync } = require('child_process');
    const code = `
      process.env.INCLUDE_COMMUNITY_EDGES = 'true';
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_FULL_DB_IN_PROD;
      const { getDb } = require('./lib/db.ts');
      getDb();
    `;

    const res = spawnSync(process.execPath, ['--experimental-strip-types', '-e', code], { encoding: 'utf8' });
    assert.equal(res.status, 1, 'Process should fail with exit code 1');
    assert.match(
      res.stderr,
      /Refusing to start: INCLUDE_COMMUNITY_EDGES=true is set in production without ALLOW_FULL_DB_IN_PROD=true/
    );
  });

  it('Gate 3.2: Brand cap <= 2 is strictly enforced across similar fragrance recommendations', () => {
    const fullDbPath = path.join(process.cwd(), 'data', 'perfumes.full.db');
    if (!fs.existsSync(fullDbPath)) return;

    const { spawnSync } = require('child_process');
    const testScript = `
      process.env.INCLUDE_COMMUNITY_EDGES = 'true';
      const { getSimilarFragrances, getFragranceById } = require('./lib/data.ts');
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync('data/perfumes.full.db');
      const targets = db.prepare('SELECT id FROM perfumes WHERE vote_count >= 500 LIMIT 50').all();
      
      let violations = 0;
      for (const t of targets) {
        const frag = getFragranceById(t.id);
        if (!frag) continue;
        const recs = getSimilarFragrances(frag, 10);
        const bCounts = {};
        for (const r of recs) {
          bCounts[r.brand] = (bCounts[r.brand] || 0) + 1;
          if (bCounts[r.brand] > 2) {
            violations++;
            console.error('Brand cap violation:', frag.name, '->', r.brand, bCounts[r.brand]);
          }
        }
      }
      if (violations > 0) process.exit(1);
    `;

    const res = spawnSync(process.execPath, ['--experimental-strip-types', '-e', testScript], { encoding: 'utf8' });
    assert.equal(res.status, 0, `Test failed with stderr: ${res.stderr}`);
  });
});
