const fs = require("fs");
const path = require("path");

const chunksDir = path.join(__dirname, "../.next/static/chunks");

for (const name of ["0cz1d0mv5g_q7.js", "1mh6a-0e61pyc.js", "2-rtuqsgzmno4.js"]) {
  const content = fs.readFileSync(path.join(chunksDir, name), "utf8");
  console.log(`\n=== ${name} ===`);
  console.log("react-dom:", content.includes("react-dom"));
  console.log("next/router:", content.includes("next/router") || content.includes("useRouter"));
  console.log("CatalogView:", content.includes("CatalogView"));
  console.log("initialFragrances:", content.includes("initialFragrances"));
  console.log("fragrances.json:", content.includes("fragrances.json") || content.includes("Sauvage"));
  // preview snippet
  console.log("Snippet:", content.slice(0, 200));
}
