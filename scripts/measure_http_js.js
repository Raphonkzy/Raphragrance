const http = require("http");

async function checkScripts() {
  const html = await new Promise((resolve) => {
    http.get("http://localhost:3001/", (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    });
  });

  const matches = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map(
    (m) => m[1]
  );
  console.log(`Found ${matches.length} initial script tags on /:`);

  let totalTransfer = 0;
  for (const src of matches) {
    const bytes = await new Promise((resolve) => {
      const req = http.get(
        `http://localhost:3001${src}`,
        { headers: { "Accept-Encoding": "gzip" } },
        (res) => {
          let chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const buf = Buffer.concat(chunks);
            resolve(buf.length);
          });
        }
      );
    });
    console.log(`  ${src}: ${(bytes / 1024).toFixed(1)} KB`);
    totalTransfer += bytes;
  }

  console.log(
    `\nTotal Initial Gzip JS: ${(totalTransfer / 1024).toFixed(1)} KB (Budget: <= 150 KB)`
  );
}

checkScripts();
