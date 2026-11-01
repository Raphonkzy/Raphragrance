const fs = require('fs');
const readline = require('readline');

async function checkJsonlForTargets() {
  const targetIds = new Set([68271, 9828, 44174, 108244, 84224]);
  const found = new Map();

  const fileStream = fs.createReadStream('D:/Raffa/Mengoding/Raphragrance/perfumes.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (targetIds.has(obj.id)) {
        found.set(obj.id, {
          id: obj.id,
          name: obj.name,
          brand: obj.brand,
          similar: obj.similar
        });
        if (found.size === targetIds.size) break;
      }
    } catch (e) {}
  }

  for (const [id, data] of found.entries()) {
    console.log(`\n=== JSONL Record for [${id}] ${data.name} (${data.brand}) ===`);
    console.log("similar field:");
    console.log(JSON.stringify(data.similar, null, 2));
  }
}

checkJsonlForTargets().catch(console.error);
