const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');
const {
  db,
  splitData,
  loadGroundTruth
} = require('./ablation_common');

async function runTestSetEvaluation() {
  console.log('Loading ground truth and test split...');
  const { adjFull } = await loadGroundTruth();

  const testQueries = splitData.test.filter(qid => adjFull.has(qid) && adjFull.get(qid).size > 0);
  const N = testQueries.length;
  console.log(`Evaluating on ${N} Test set queries with Ground Truth...`);

  const stmtContent = db.prepare(`
    SELECT similar_id, rank, score, source
    FROM similar
    WHERE fragrance_id = ? AND source = 'content'
    ORDER BY rank ASC
    LIMIT 30
  `);

  const stmtComm = db.prepare(`
    SELECT similar_id, rank, score, source
    FROM similar
    WHERE fragrance_id = ? AND source = 'community'
    ORDER BY rank ASC
    LIMIT 30
  `);

  function getContentRecs(qid, topK = 10) {
    const rows = stmtContent.all(qid);
    return rows.slice(0, topK).map(r => r.similar_id);
  }

  function getHybridRecs(qid, topK = 10) {
    const comm = stmtComm.all(qid);
    const selected = [];
    const seen = new Set();
    seen.add(qid);

    for (const r of comm) {
      selected.push(r.similar_id);
      seen.add(r.similar_id);
      if (selected.length >= topK) return selected;
    }

    const content = stmtContent.all(qid);
    for (const r of content) {
      if (!seen.has(r.similar_id)) {
        selected.push(r.similar_id);
        seen.add(r.similar_id);
        if (selected.length >= topK) break;
      }
    }
    return selected;
  }

  function evalMetrics(recs, qgt) {
    const isHit = recs.some(id => qgt.has(id)) ? 1 : 0;
    const sortedGT = Array.from(qgt.entries()).sort((a, b) => b[1] - a[1]);
    const top3GT = sortedGT.slice(0, 3).map(e => e[0]);
    const top3Found = top3GT.filter(id => recs.includes(id)).length;
    const topGTRecall = top3GT.length > 0 ? (top3Found / top3GT.length) : 0;

    let matchCount = 0;
    let firstRank = 0;
    let dcg = 0;
    recs.forEach((id, idx) => {
      const rank = idx + 1;
      if (qgt.has(id)) {
        matchCount++;
        if (firstRank === 0) firstRank = rank;
        const rel = qgt.get(id);
        dcg += rel / Math.log2(rank + 1);
      }
    });

    const precision = matchCount / 10;
    const mrr = firstRank > 0 ? (1 / firstRank) : 0;
    let idcg = 0;
    for (let i = 0; i < Math.min(10, sortedGT.length); i++) {
      idcg += sortedGT[i][1] / Math.log2(i + 2);
    }
    const ndcg = idcg > 0 ? (dcg / idcg) : 0;

    return { isHit, topGTRecall, precision, mrr, ndcg };
  }

  function collectMetrics(getRecsFn) {
    const hits = new Float32Array(N);
    const recalls = new Float32Array(N);
    const precs = new Float32Array(N);
    const mrrs = new Float32Array(N);
    const ndcgs = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      const qid = testQueries[i];
      const qgt = adjFull.get(qid);
      const recs = getRecsFn(qid);
      const m = evalMetrics(recs, qgt);
      hits[i] = m.isHit;
      recalls[i] = m.topGTRecall;
      precs[i] = m.precision;
      mrrs[i] = m.mrr;
      ndcgs[i] = m.ndcg;
    }
    return { hits, recalls, precs, mrrs, ndcgs };
  }

  const mContent = collectMetrics(getContentRecs);
  const mHybrid = collectMetrics(getHybridRecs);

  // Bootstrap 95% CIs
  const B = 1000;
  const resampleIndices = [];
  for (let b = 0; b < B; b++) {
    const idxs = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      idxs[i] = Math.floor(Math.random() * N);
    }
    resampleIndices.push(idxs);
  }

  function getStats(m) {
    const mean = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;
    const ptHit = mean(m.hits);
    const ptRec = mean(m.recalls);
    const ptPrec = mean(m.precs);
    const ptMrr = mean(m.mrrs);
    const ptNdcg = mean(m.ndcgs);

    const bHit = new Float32Array(B);
    const bRec = new Float32Array(B);
    const bPrec = new Float32Array(B);
    const bMrr = new Float32Array(B);
    const bNdcg = new Float32Array(B);

    for (let b = 0; b < B; b++) {
      const idxs = resampleIndices[b];
      let sH = 0, sR = 0, sP = 0, sM = 0, sN = 0;
      for (let i = 0; i < N; i++) {
        const idx = idxs[i];
        sH += m.hits[idx];
        sR += m.recalls[idx];
        sP += m.precs[idx];
        sM += m.mrrs[idx];
        sN += m.ndcgs[idx];
      }
      bHit[b] = sH / N;
      bRec[b] = sR / N;
      bPrec[b] = sP / N;
      bMrr[b] = sM / N;
      bNdcg[b] = sN / N;
    }

    const getCI = (arr) => {
      const s = Array.from(arr).sort((a, b) => a - b);
      return { low: s[Math.floor(B * 0.025)], high: s[Math.floor(B * 0.975)] };
    };

    return {
      pt: { hit: ptHit, rec: ptRec, prec: ptPrec, mrr: ptMrr, ndcg: ptNdcg },
      ci: {
        hit: getCI(bHit),
        rec: getCI(bRec),
        prec: getCI(bPrec),
        mrr: getCI(bMrr),
        ndcg: getCI(bNdcg)
      }
    };
  }

  const sContent = getStats(mContent);
  const sHybrid = getStats(mHybrid);

  console.log('\n========================================================================================================================');
  console.log('UNTOUCHED TEST SET FINAL EVALUATION (N = 1,000 QUERIES, B = 1,000 BOOTSTRAP)');
  console.log('========================================================================================================================');
  console.log('Metric               | Target     | Content-Only Mode [95% CI]      | Hybrid Mode [95% CI]            | Target Status');
  console.log('---------------------|------------|---------------------------------|---------------------------------|--------------');

  function fmtRow(name, tgt, cPt, cLow, cHigh, hPt, hLow, hHigh, isPct = true) {
    const scale = isPct ? 100 : 1;
    const unit = isPct ? '%' : '';
    const cStr = `${(cPt * scale).toFixed(2)}${unit} [${(cLow * scale).toFixed(2)}-${(cHigh * scale).toFixed(2)}]`;
    const hStr = `${(hPt * scale).toFixed(2)}${unit} [${(hLow * scale).toFixed(2)}-${(hHigh * scale).toFixed(2)}]`;
    const cPass = cPt >= tgt;
    const hPass = hPt >= tgt;
    const status = `Content: ${cPass ? 'PASS' : 'FAIL'} | Hybrid: ${hPass ? 'PASS' : 'FAIL'}`;
    const tgtStr = isPct ? `>= ${(tgt * 100).toFixed(0)}%` : `>= ${tgt.toFixed(2)}`;
    console.log(`${name.padEnd(20)} | ${tgtStr.padEnd(10)} | ${cStr.padEnd(31)} | ${hStr.padEnd(31)} | ${status}`);
  }

  fmtRow('TopGT Recall@10', 0.20, sContent.pt.rec, sContent.ci.rec.low, sContent.ci.rec.high, sHybrid.pt.rec, sHybrid.ci.rec.low, sHybrid.ci.rec.high);
  fmtRow('Hit@10', 0.50, sContent.pt.hit, sContent.ci.hit.low, sContent.ci.hit.high, sHybrid.pt.hit, sHybrid.ci.hit.low, sHybrid.ci.hit.high);
  fmtRow('Precision@10', 0.09, sContent.pt.prec, sContent.ci.prec.low, sContent.ci.prec.high, sHybrid.pt.prec, sHybrid.ci.prec.low, sHybrid.ci.prec.high);
  fmtRow('MRR', 0.35, sContent.pt.mrr, sContent.ci.mrr.low, sContent.ci.mrr.high, sHybrid.pt.mrr, sHybrid.ci.mrr.low, sHybrid.ci.mrr.high, false);
  fmtRow('nDCG@10', 0.18, sContent.pt.ndcg, sContent.ci.ndcg.low, sContent.ci.ndcg.high, sHybrid.pt.ndcg, sHybrid.ci.ndcg.low, sHybrid.ci.ndcg.high);
  console.log('========================================================================================================================\n');

  // Acceptance cases on precomputed SQLite
  console.log('=== ACCEPTANCE CASES ON PRECOMPUTED SQLITE DATABASE ===');
  const pairs = [
    { q: 68271, t: 9828, qN: 'SNOI', tN: 'Aventus', max: 10 },
    { q: 68271, t: 44174, qN: 'SNOI', tN: 'Hacivat', max: 10 },
    { q: 108244, t: 84224, qN: 'Turathi Electric', tN: 'Blue Talisman', max: 10 },
    { q: 9828, t: 68271, qN: 'Aventus', tN: 'SNOI', max: 20 },
    { q: 84224, t: 108244, qN: 'Blue Talisman', tN: 'Turathi Electric', max: 20 }
  ];

  console.log('Case                                       | Target     | Content-Only Rank | Hybrid Rank');
  console.log('-------------------------------------------|------------|-------------------|------------');
  for (const p of pairs) {
    const cRecs = getContentRecs(p.q, 30);
    const hRecs = getHybridRecs(p.q, 30);
    const cR = cRecs.indexOf(p.t) + 1;
    const hR = hRecs.indexOf(p.t) + 1;

    const cStr = cR > 0 ? `#${cR}` : '> 30';
    const hStr = hR > 0 ? `#${hR}` : '> 30';
    const caseName = `${p.qN} (${p.q}) -> ${p.tN} (${p.t})`;
    console.log(`${caseName.padEnd(42)} | <= #${p.max.toString().padEnd(7)} | ${cStr.padEnd(17)} | ${hStr}`);
  }
}

runTestSetEvaluation().catch(console.error);
