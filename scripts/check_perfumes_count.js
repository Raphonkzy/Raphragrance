const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

// Check perfumes count and schema
const count = db.prepare('SELECT COUNT(*) as c FROM perfumes').get().c;
console.log(`Total perfumes in DB: ${count}`);

// Check if similar table exists
const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='similar'").get();
console.log('Similar table exists:', !!tableCheck);
