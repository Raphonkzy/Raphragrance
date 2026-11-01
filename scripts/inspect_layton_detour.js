const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

const rows = db.prepare('SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat FROM perfumes').all();
const byId = new Map(rows.map(r => [r.id, r]));

// Check Layton (39314) and Détour Noir (67711 or whatever its ID is)
const detours = rows.filter(r => r.name.toLowerCase().includes('détour noir') || r.name.toLowerCase().includes('detour noir'));
console.log('Detour Noir matches in DB:', detours.map(d => ({ id: d.id, name: d.name, brand: d.brand })));

// Check Explorer (52002) for Aventus (9828)
console.log('Aventus (9828):', byId.get(9828)?.name, byId.get(9828)?.accords);
console.log('Explorer (52002):', byId.get(52002)?.name, byId.get(52002)?.accords);
