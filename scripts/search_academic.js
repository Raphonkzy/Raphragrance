// Script to search academic and open-source sources on perfume/fragrance recommendation and similarity
async function searchSources() {
  const urlsToFetch = [
    // 1. Academic paper: Principal Odor Map (Lee et al., Science 2023 / bioRxiv)
    'https://www.science.org/doi/10.1126/science.ade4401',
    // 2. Academic: Fragrance/Flavor network and similarity (e.g., Ahn et al. Flavor network, or arXiv on perfume recommendation)
    'https://arxiv.org/abs/2112.11598', // check what this is or find perfume papers
    // 3. GitHub repos on perfume recommender
    'https://github.com/statisticianinstilettos/niche_perfume_chatbot',
    'https://github.com/rdemarqui/perfume_recommender',
  ];

  // Let's search Semantic Scholar for perfume recommendation papers
  try {
    const res = await fetch('https://api.semanticscholar.org/graph/v1/paper/search?query=perfume+recommendation+system+OR+fragrance+similarity&limit=5&fields=title,url,abstract,year,authors');
    const data = await res.json();
    console.log("Semantic Scholar papers found:");
    if (data.data) {
      for (const p of data.data) {
        console.log(`- Title: ${p.title} (${p.year})`);
        console.log(`  URL: ${p.url}`);
        console.log(`  Abstract: ${(p.abstract || '').slice(0, 200)}...\n`);
      }
    }
  } catch (e) {
    console.error("Semantic Scholar error:", e.message);
  }

  // Let's search arXiv for perfume / olfaction / recommendation papers
  try {
    const res = await fetch('http://export.arxiv.org/api/query?search_query=all:perfume+OR+all:fragrance+OR+all:olfactory+similarity&start=0&max_results=5');
    const text = await res.text();
    console.log("Arxiv search completed. Length:", text.length);
  } catch (e) {
    console.error("Arxiv error:", e.message);
  }
}

searchSources();
