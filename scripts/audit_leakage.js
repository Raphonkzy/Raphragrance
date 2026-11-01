const fs = require('fs');
const readline = require('readline');

async function auditAiSummary() {
  console.log('Auditing ai_summary and also_liked in perfumes.jsonl...');
  const rl = readline.createInterface({
    input: fs.createReadStream('D:/Raffa/Mengoding/Raphragrance/perfumes.jsonl'),
    crlfDelay: Infinity
  });

  let totalPerfumes = 0;
  let hasAiSummary = 0;
  let hasAlsoLiked = 0;
  let leakMatches = 0;
  const leakExamples = [];

  const leakRegex = /\b(remind|reminiscent|similar to|dupe|clone|alternative to|inspired by|smells like|identical to|twist on|comparable to)\b/i;
  const famousFragrances = /\b(aventus|baccarat rouge|br540|sauvage|santal 33|lost cherry|delina|angels' share|green irish tweed|blue talisman|tuscan leather)\b/i;

  for await (const line of rl) {
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      totalPerfumes++;

      if (o.similar && o.similar.also_liked && o.similar.also_liked.length > 0) {
        hasAlsoLiked++;
      }

      if (o.ai_summary) {
        hasAiSummary++;
        const summaryText = typeof o.ai_summary === 'string' ? o.ai_summary : JSON.stringify(o.ai_summary);
        
        const hasLeakVerb = leakRegex.test(summaryText);
        const hasFamousName = famousFragrances.test(summaryText);

        if (hasLeakVerb || hasFamousName) {
          leakMatches++;
          if (leakExamples.length < 10) {
            leakExamples.push({
              id: o.id,
              name: o.name,
              brand: o.brand,
              summary: summaryText.slice(0, 250)
            });
          }
        }
      }
    } catch (e) {}
  }

  console.log(`\nAudit Results (Total perfumes: ${totalPerfumes}):`);
  console.log(`- Perfumes with also_liked: ${hasAlsoLiked} (${((hasAlsoLiked/totalPerfumes)*100).toFixed(1)}%)`);
  console.log(`- Perfumes with ai_summary: ${hasAiSummary} (${((hasAiSummary/totalPerfumes)*100).toFixed(1)}%)`);
  console.log(`- ai_summary with explicit leakage signals (names of other perfumes / similarity keywords): ${leakMatches} (${((leakMatches/Math.max(1, hasAiSummary))*100).toFixed(2)}% of summaries)`);

  console.log(`\nSample Leakage Examples from ai_summary:`);
  leakExamples.forEach((ex, idx) => {
    console.log(`[${idx+1}] ${ex.name} (${ex.brand}) [ID: ${ex.id}]:`);
    console.log(`    "${ex.summary}..."\n`);
  });
}

auditAiSummary().catch(console.error);
