const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseAndValidateCuratedOverrides } = require('../lib/curated_loader');

// Mock slug lookup
const mockDb = new Map([
  ['Afnan/Supremacy-Not-Only-Intense', { id: 68271, name: 'Supremacy Not Only Intense', brand: 'Afnan' }],
  ['Creed/Aventus', { id: 9828, name: 'Aventus', brand: 'Creed' }],
  ['Nishane/Hacivat', { id: 44174, name: 'Hacivat', brand: 'Nishane' }],
  ['Afnan/Turathi-Electric', { id: 108244, name: 'Turathi Electric', brand: 'Afnan' }],
  ['Ex-Nihilo/Blue-Talisman', { id: 84224, name: 'Blue Talisman', brand: 'Ex Nihilo' }]
]);

const lookup = (slug) => mockDb.get(slug) || null;

describe('Curated Overrides Loader Validation (Gate 2.3)', () => {
  it('passes on valid owner-provided pairs', () => {
    const validCsv = `a_slug,b_slug,strength,note
Afnan/Supremacy-Not-Only-Intense,Creed/Aventus,1.0,owner-provided
Afnan/Supremacy-Not-Only-Intense,Nishane/Hacivat,0.95,owner-provided
Afnan/Turathi-Electric,Ex-Nihilo/Blue-Talisman,0.95,owner-provided`;

    const res = parseAndValidateCuratedOverrides(validCsv, lookup);
    assert.equal(res.length, 3);
    assert.equal(res[0].idA, 68271);
    assert.equal(res[0].idB, 9828);
    assert.equal(res[0].strength, 1.0);
    assert.equal(res[0].note, 'owner-provided');
  });

  it('fails on unknown slug', () => {
    const csv = `a_slug,b_slug,strength,note
Afnan/Supremacy-Not-Only-Intense,Unknown/Non-Existent-Perfume,1.0,owner-provided`;

    assert.throws(
      () => parseAndValidateCuratedOverrides(csv, lookup),
      /Unknown slug at line 2: "Unknown\/Non-Existent-Perfume"/
    );
  });

  it('fails on self pair (a_slug === b_slug)', () => {
    const csv = `a_slug,b_slug,strength,note
Creed/Aventus,Creed/Aventus,1.0,self pair error`;

    assert.throws(
      () => parseAndValidateCuratedOverrides(csv, lookup),
      /Self pair violation at line 2/
    );
  });

  it('fails on duplicate pair (direct or reverse)', () => {
    const csvDirect = `a_slug,b_slug,strength,note
Afnan/Supremacy-Not-Only-Intense,Creed/Aventus,1.0,owner-provided
Afnan/Supremacy-Not-Only-Intense,Creed/Aventus,0.9,duplicate`;

    assert.throws(
      () => parseAndValidateCuratedOverrides(csvDirect, lookup),
      /Duplicate pair violation at line 3/
    );

    const csvReverse = `a_slug,b_slug,strength,note
Afnan/Supremacy-Not-Only-Intense,Creed/Aventus,1.0,owner-provided
Creed/Aventus,Afnan/Supremacy-Not-Only-Intense,1.0,reverse duplicate`;

    assert.throws(
      () => parseAndValidateCuratedOverrides(csvReverse, lookup),
      /Duplicate pair violation at line 3/
    );
  });

  it('fails on strength outside range [0.0, 1.0]', () => {
    const csvTooHigh = `a_slug,b_slug,strength,note
Afnan/Supremacy-Not-Only-Intense,Creed/Aventus,1.5,too strong`;

    assert.throws(
      () => parseAndValidateCuratedOverrides(csvTooHigh, lookup),
      /Strength outside range/
    );

    const csvNegative = `a_slug,b_slug,strength,note
Afnan/Supremacy-Not-Only-Intense,Creed/Aventus,-0.1,negative`;

    assert.throws(
      () => parseAndValidateCuratedOverrides(csvNegative, lookup),
      /Strength outside range/
    );

    const csvNaN = `a_slug,b_slug,strength,note
Afnan/Supremacy-Not-Only-Intense,Creed/Aventus,very_strong,not a number`;

    assert.throws(
      () => parseAndValidateCuratedOverrides(csvNaN, lookup),
      /Strength outside range/
    );
  });

  it('fails on malformed row', () => {
    const csvShort = `a_slug,b_slug,strength,note
Afnan/Supremacy-Not-Only-Intense,Creed/Aventus`;

    assert.throws(
      () => parseAndValidateCuratedOverrides(csvShort, lookup),
      /Malformed row at line 2/
    );

    const csvEmptySlug = `a_slug,b_slug,strength,note
,Creed/Aventus,0.95,empty a`;

    assert.throws(
      () => parseAndValidateCuratedOverrides(csvEmptySlug, lookup),
      /empty slug detected/
    );

    const csvBadHeader = `slugA,slugB,score,comment
Afnan/Supremacy-Not-Only-Intense,Creed/Aventus,1.0,test`;

    assert.throws(
      () => parseAndValidateCuratedOverrides(csvBadHeader, lookup),
      /Invalid CSV header/
    );
  });
});
