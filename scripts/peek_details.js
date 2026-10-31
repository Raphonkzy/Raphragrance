const fs = require("fs");
const path = require("path");

const s = fs.readFileSync(path.join(__dirname, "../.next/static/chunks/0cz1d0mv5g_q7.js"), "utf8");
console.log("length:", s.length);
console.log(s.slice(0, 500));
console.log("...");
console.log(s.slice(-500));
