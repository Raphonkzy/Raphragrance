const { verifyContrast } = require("./test_contrast_single");

for (const [fill, ink] of [
  ["#158597", "#EFF9FA"],
  ["#188E9B", "#F0FAFC"],
  ["#1A94A0", "#F1FBFC"],
  ["#127D8F", "#EDF8F9"],
  ["#197E96", "#EDF8FA"],
]) {
  console.log(fill, ink, verifyContrast(fill, ink));
}
