const fs = require("fs");
const path = require("path");

const s2 = fs.readFileSync(path.join(__dirname, "../.next/static/chunks/2-rtuqsgzmno4.js"), "utf8");
console.log(s2.slice(0, 400));
