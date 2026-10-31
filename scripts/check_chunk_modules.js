const fs = require("fs");
const path = require("path");

function findModules(filename) {
  const code = fs.readFileSync(path.join(__dirname, "../.next/static/chunks", filename), "utf8");
  const moduleNames = new Set();
  const matches = code.matchAll(/"([^"]*node_modules[^"]*)"/g);
  for (const m of matches) {
    moduleNames.add(m[1]);
  }
  const appMatches = code.matchAll(/"\[project\]\/([^"]+)"/g);
  for (const m of appMatches) {
    moduleNames.add(m[1]);
  }
  console.log(`=== ${filename} ===`);
  const arr = [...moduleNames];
  console.log(`Found ${arr.length} module references:`);
  for (const name of arr.slice(0, 20)) {
    console.log("  ", name);
  }
}

findModules("0cz1d0mv5g_q7.js");
findModules("1mh6a-0e61pyc.js");
findModules("2-rtuqsgzmno4.js");
