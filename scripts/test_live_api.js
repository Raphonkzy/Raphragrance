const http = require("http");

async function fetchRoute(path) {
  const t0 = performance.now();
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3009${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const duration = performance.now() - t0;
        resolve({
          status: res.statusCode,
          duration: Math.round(duration),
          contentType: res.headers["content-type"],
          length: data.length,
          body: data,
        });
      });
    }).on("error", reject);
  });
}

async function run() {
  console.log("Waiting for server...");
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetchRoute("/api/health");
      if (res.status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!ready) {
    console.error("Server did not become ready in time.");
    process.exit(1);
  }

  console.log("Server ready! Testing all endpoints...\n");

  const routes = [
    "/api/health",
    "/api/fragrances?limit=5",
    "/api/fragrances?q=Sauvage",
    "/api/fragrances?gender=Men&sort=rating&limit=5",
    "/api/fragrances/31861",
    "/api/fragrances/31861/similar?limit=4",
    "/api/brands?q=Dior",
    "/api/brands/Dior",
    "/api/notes?limit=5",
    "/api/accords",
    "/",
    "/fragrance/Dior/Sauvage",
    "/brands",
    "/brand/Dior",
    "/notes",
    "/accords",
  ];

  for (const route of routes) {
    const res = await fetchRoute(route);
    let sample = "";
    if (res.contentType?.includes("application/json")) {
      try {
        const json = JSON.parse(res.body);
        if (json.data && Array.isArray(json.data)) {
          sample = `items: ${json.data.length}, total: ${json.total ?? json.data.length}`;
        } else if (json.data && typeof json.data === "object") {
          sample = json.data.name || json.data.brand || "object";
        } else if (json.status) {
          sample = `status: ${json.status}, db: ${json.database?.perfumes_count}`;
        }
      } catch {}
    } else {
      sample = `HTML (${res.length} bytes)`;
    }

    const pass = res.status === 200 ? "PASS" : "FAIL";
    console.log(`[${pass}] ${res.status} | ${res.duration.toString().padStart(4, " ")}ms | ${route.padEnd(46, " ")} | ${sample}`);
  }
}

run().catch(console.error);
