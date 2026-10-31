function srgbLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function hexToRgb(hex) {
  hex = hex.replace("#", "");
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function contrast(rgb1, rgb2) {
  const l1 = srgbLuminance(...rgb1);
  const l2 = srgbLuminance(...rgb2);
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

console.log("=== WCAG AA Text Contrast ===");
const lightBg = hexToRgb("F0F0EE");
const lightSf = hexToRgb("FFFFFF");
const lightTx = hexToRgb("0F0F0D");
const lightTx2 = hexToRgb("5C5C58");
const lightAc = hexToRgb("0055CC");
const lightAc2 = hexToRgb("CC3300");

console.log("Light theme:");
console.log("  --tx on --bg: ", contrast(lightTx, lightBg).toFixed(2), " (req 4.5:1)");
console.log("  --tx on --sf: ", contrast(lightTx, lightSf).toFixed(2), " (req 4.5:1)");
console.log("  --tx2 on --bg:", contrast(lightTx2, lightBg).toFixed(2), " (req 4.5:1)");
console.log("  --tx2 on --sf:", contrast(lightTx2, lightSf).toFixed(2), " (req 4.5:1)");
console.log("  --ac on --bg: ", contrast(lightAc, lightBg).toFixed(2), " (req 4.5:1)");
console.log("  --ac on --sf: ", contrast(lightAc, lightSf).toFixed(2), " (req 4.5:1)");

const darkBg = hexToRgb("0F0F0D");
const darkSf = hexToRgb("161614");
const darkTx = hexToRgb("E8E8E4");
const darkTx2 = hexToRgb("888884");
const darkAc = hexToRgb("4D8FFF");
const darkAc2 = hexToRgb("FF6644");

console.log("\nDark theme:");
console.log("  --tx on --bg: ", contrast(darkTx, darkBg).toFixed(2), " (req 4.5:1)");
console.log("  --tx on --sf: ", contrast(darkTx, darkSf).toFixed(2), " (req 4.5:1)");
console.log("  --tx2 on --bg:", contrast(darkTx2, darkBg).toFixed(2), " (req 4.5:1)");
console.log("  --tx2 on --sf:", contrast(darkTx2, darkSf).toFixed(2), " (req 4.5:1)");
console.log("  --ac on --bg: ", contrast(darkAc, darkBg).toFixed(2), " (req 4.5:1)");
console.log("  --ac on --sf: ", contrast(darkAc, darkSf).toFixed(2), " (req 4.5:1)");

console.log("\n=== Accord Ramp Non-Text Contrast (req >= 3.0:1) ===");
for (let i = 0; i < 6; i++) {
  const L = 28 + i * 10;
  const rgb = hslToRgb(215, 65, L);
  const crLightBg = contrast(rgb, lightBg).toFixed(2);
  const crDarkBg = contrast(rgb, darkBg).toFixed(2);
  const crDarkSf = contrast(rgb, darkSf).toFixed(2);
  console.log(`  i=${i} L=${L}% (RGB ${rgb.join(",")}): vs lightBg: ${crLightBg}:1 | vs darkBg: ${crDarkBg}:1 | vs darkSf: ${crDarkSf}:1`);
}
