const fs = require("fs");
const path = require("path");

const content = fs.readFileSync(path.join(__dirname, "../.next/static/chunks/0cz1d0mv5g_q7.js"), "utf8");
console.log(content.slice(0, 1000));
