const fs = require('fs');
const readline = require('readline');

async function inspectAnchorsInRaw() {
  const targetIds = new Set([48332, 51944, 26017, 60335]);
  const rl = readline.createInterface({
    input: fs.createReadStream('D:/Raffa/Mengoding/Raphragrance/perfumes.jsonl'),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      if (targetIds.has(o.id)) {
        console.log(`Anchor in JSONL: [${o.id}] ${o.name} (${o.brand})`);
        const rList = (o.similar && o.similar.reminds_me_of) || [];
        console.log(`  reminds_me_of length: ${rList.length}`);
        rList.slice(0, 5).forEach(r => {
          console.log(`    -> [${r.id}] ${r.name} | up: ${r.up_votes}, down: ${r.down_votes}`);
        });
      }
    } catch (e) {}
  }
}

inspectAnchorsInRaw().catch(console.error);
