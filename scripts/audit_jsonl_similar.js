const fs = require('fs');
const readline = require('readline');

async function auditJsonlSimilar() {
  const fileStream = fs.createReadStream('D:/Raffa/Mengoding/Raphragrance/perfumes.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let total = 0;
  let hasRemindsMeOf = 0;
  let totalEdges = 0;
  let hasAlsoLiked = 0;

  for await (const line of rl) {
    if (!line) continue;
    total++;
    try {
      const obj = JSON.parse(line);
      if (obj.similar) {
        if (Array.isArray(obj.similar.reminds_me_of) && obj.similar.reminds_me_of.length > 0) {
          hasRemindsMeOf++;
          totalEdges += obj.similar.reminds_me_of.length;
        }
        if (Array.isArray(obj.similar.also_liked) && obj.similar.also_liked.length > 0) {
          hasAlsoLiked++;
        }
      }
    } catch (e) {}
    if (total % 25000 === 0) {
      console.log(`Processed ${total} records... (hasReminds: ${hasRemindsMeOf})`);
    }
  }

  console.log(`\n=== JSONL SIMILAR AUDIT COMPLETE ===`);
  console.log(`Total JSONL records: ${total}`);
  console.log(`Records with 'reminds_me_of': ${hasRemindsMeOf} (${(hasRemindsMeOf / total * 100).toFixed(2)}%)`);
  console.log(`Total 'reminds_me_of' edges: ${totalEdges}`);
  console.log(`Records with 'also_liked': ${hasAlsoLiked} (${(hasAlsoLiked / total * 100).toFixed(2)}%)`);
}

auditJsonlSimilar().catch(console.error);
