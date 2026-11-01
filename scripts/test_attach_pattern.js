const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dbMain = new DatabaseSync('data/test_main.db');
dbMain.exec(`
  CREATE TABLE items (id INTEGER, val REAL);
`);

const dbW1 = new DatabaseSync('data/test_w1.db');
dbW1.exec(`
  CREATE TABLE items (id INTEGER, val REAL);
  INSERT INTO items VALUES (1, 10.5), (2, 20.5);
`);
dbW1.close();

dbMain.exec(`
  ATTACH DATABASE 'data/test_w1.db' AS w1;
  INSERT INTO items SELECT * FROM w1.items;
  DETACH DATABASE w1;
`);

const count = dbMain.prepare('SELECT COUNT(*) as c FROM items').get().c;
console.log('Main DB item count after ATTACH & INSERT:', count);

dbMain.close();
fs.unlinkSync('data/test_main.db');
fs.unlinkSync('data/test_w1.db');
