function srgbLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
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

const lightBg = [240, 240, 238]; // #F0F0EE
const darkBg = [15, 15, 13];    // #0F0F0D

// Light theme: dark blue against light bg.
// To have contrast >= 3.0:1 against lightBg (lum 0.852), max color luminance is (0.852 + 0.05)/3.0 - 0.05 = 0.250.
console.log("Searching Light theme ramp (5 steps, descending darkness, all >= 3:1 vs lightBg):");
for (let L = 20; L <= 60; L += 5) {
  const rgb = hslToRgb(215, 65, L);
  const cr = contrast(rgb, lightBg);
  console.log(`  L=${L}%: contrast=${cr.toFixed(2)}:1 (lum=${srgbLuminance(...rgb).toFixed(3)})`);
}

// Dark theme: light blue against dark bg.
// To have contrast >= 3.0:1 against darkBg (lum 0.0053), min color luminance is (0.0053 + 0.05)*3.0 - 0.05 = 0.1159.
console.log("\nSearching Dark theme ramp (5 steps, ascending lightness, all >= 3:1 vs darkBg):");
for (let L = 40; L <= 80; L += 5) {
  const rgb = hslToRgb(215, 65, L);
  const cr = contrast(rgb, darkBg);
  console.log(`  L=${L}%: contrast=${cr.toFixed(2)}:1 (lum=${srgbLuminance(...rgb).toFixed(3)})`);
}
