const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

const rows = db.prepare('SELECT DISTINCT gender FROM perfumes').all();
console.log('Distinct gender values in SQLite:', rows);
