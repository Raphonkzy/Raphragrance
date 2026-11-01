// Parse arXiv results
const fs = require('fs');

async function parseArxiv() {
  const query = 'all:olfactory+AND+all:embedding+OR+all:fragrance+OR+all:"perfume"';
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=8`;
  const res = await fetch(url);
  const text = await res.text();
  
  const entries = text.split('<entry>');
  for (let i = 1; i < entries.length; i++) {
    const e = entries[i];
    const titleMatch = e.match(/<title>([\s\S]*?)<\/title>/);
    const summaryMatch = e.match(/<summary>([\s\S]*?)<\/summary>/);
    const idMatch = e.match(/<id>(.*?)<\/id>/);
    
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'No title';
    const summary = summaryMatch ? summaryMatch[1].replace(/\s+/g, ' ').trim() : '';
    const id = idMatch ? idMatch[1].trim() : '';
    
    console.log(`Paper ${i}: ${title}`);
    console.log(`URL: ${id}`);
    console.log(`Summary: ${summary.slice(0, 200)}...\n`);
  }
}

parseArxiv().catch(console.error);
