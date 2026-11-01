const fs = require('fs');
const readline = require('readline');

async function inspectJsonl() {
  const fileStream = fs.createReadStream('D:/Raffa/Mengoding/Raphragrance/perfumes.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  for await (const line of rl) {
    if (count === 0) {
      const obj = JSON.parse(line);
      console.log("Keys in perfumes.jsonl first record:");
      console.log(Object.keys(obj));
      console.log("\nFull sample record (truncated values):");
      for (const [k, v] of Object.entries(obj)) {
        console.log(`  ${k}: ${typeof v === 'string' && v.length > 100 ? v.slice(0, 100) + '...' : JSON.stringify(v)}`);
      }
    }
    count++;
    if (count >= 5) break;
  }
  console.log(`\nChecked ${count} records.`);
}

inspectJsonl().catch(console.error);
