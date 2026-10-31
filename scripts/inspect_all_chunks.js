const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "../.next/static/chunks");
const files = fs.readdirSync(dir);
for (const f of files) {
  if (!f.endsWith(".js")) continue;
  const content = fs.readFileSync(path.join(dir, f), "utf8");
  console.log(f, (content.length / 1024).toFixed(1) + " KB", content.slice(0, 80));
}
