const http = require("http");

http.get("http://localhost:3001/", (res) => {
  let html = "";
  res.on("data", (c) => (html += c));
  res.on("end", () => {
    const scripts = html.match(/<script[^>]+src=[^>]+>/g) || [];
    console.log("Found scripts:");
    for (const s of scripts) {
      console.log(" ", s);
    }
  });
});
