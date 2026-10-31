const fs = require("fs");
const path = require("path");

const s1 = fs.readFileSync(path.join(__dirname, "../.next/static/chunks/1mh6a-0e61pyc.js"), "utf8");
console.log("1mh6a length:", s1.length);
if (s1.includes("react-dom")) console.log("contains react-dom");
if (s1.includes("next/dist")) console.log("contains next/dist");
if (s1.includes("CatalogView")) console.log("contains CatalogView");
if (s1.includes("fragrances")) console.log("contains fragrances");

const s2 = fs.readFileSync(path.join(__dirname, "../.next/static/chunks/2-rtuqsgzmno4.js"), "utf8");
console.log("2-rtuq length:", s2.length);
if (s2.includes("react-dom")) console.log("contains react-dom");
if (s2.includes("next/dist")) console.log("contains next/dist");
if (s2.includes("CatalogView")) console.log("contains CatalogView");
if (s2.includes("fragrances")) console.log("contains fragrances");
