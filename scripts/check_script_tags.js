const http = require("http");

http.get("http://localhost:3001/", (res) => {
  let data = "";
  res.on("data", (c) => (data += c));
  res.on("end", () => {
    const scripts = [...data.matchAll(/<script[^>]*>.*?<\/script>/gs)].map((m) => m[0]);
    console.log(`Found ${scripts.length} script elements in HTML:`);
    for (const s of scripts) {
      console.log(s.slice(0, 150));
    }
  });
});
