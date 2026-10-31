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

function contrast(rgb1, rgb2) {
  const l1 = srgbLuminance(...rgb1);
  const l2 = srgbLuminance(...rgb2);
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

function colorMix(cHex, bgHex, pctC) {
  const c = hexToRgb(cHex);
  const bg = hexToRgb(bgHex);
  const p = pctC / 100;
  return [
    Math.round(c[0] * p + bg[0] * (1 - p)),
    Math.round(c[1] * p + bg[1] * (1 - p)),
    Math.round(c[2] * p + bg[2] * (1 - p)),
  ];
}

const lightBg = hexToRgb("#FFFFFF");
const lightTx = hexToRgb("#0E0E0E");
const lightMu = hexToRgb("#5F5F5A");

const darkBg = hexToRgb("#0C0C0C");
const darkTx = hexToRgb("#F2F2EF");
const darkMu = hexToRgb("#9A9A95");

console.log("Check --mu on --bg:");
console.log("  Light: --mu on --bg =", contrast(lightMu, lightBg).toFixed(2), ">= 4.5?", contrast(lightMu, lightBg) >= 4.5);
console.log("  Dark:  --mu on --bg =", contrast(darkMu, darkBg).toFixed(2), ">= 4.5?", contrast(darkMu, darkBg) >= 4.5);

const BASE_PAL = {
  'fresh spicy': ['#1F5D50', '#F2EFE6'],
  'woody': ['#7B4B2A', '#F7EFE6'],
  'amber': ['#E0A030', '#1C1406'],
  'vanilla': ['#EFE0BC', '#2A2012'],
  'fruity': ['#E4572E', '#140A05'],
  'aldehydic': ['#CFDBE0', '#14232B'],
  'citrus': ['#F0C419', '#1E1800'],
  'aromatic': ['#3F6F4A', '#F4F7F2'],
  'warm spicy': ['#A8401F', '#FBF0E8'],
  'leather': ['#4A2E22', '#F3E8DF'],
  'powdery': ['#D5C8E0', '#221A2C'],
  'sweet': ['#D9577A', '#1A0710'],
  'floral': ['#E58FA8', '#2A0F18'],
  'musky': ['#B8A9A0', '#1F1915'],
  'coffee': ['#3A2418', '#F3E6DA'],
  'white floral': ['#F0DDE4', '#2B1A21'],
  'smoky': ['#4A4A52', '#F0F0F2']
};

function verifyPair(name, [fill, ink]) {
  const cRgb = hexToRgb(fill);
  const iRgb = hexToRgb(ink);

  // Rule 1: --i on --c >= 4.5
  const crInk = contrast(iRgb, cRgb);

  // Rule 2: --tx on 18% and 36% tint in light and dark
  // Light:
  const t18Light = colorMix(fill, "#FFFFFF", 18);
  const crT18Light = contrast(lightTx, t18Light);
  const t36Light = colorMix(fill, "#FFFFFF", 36);
  const crT36Light = contrast(lightTx, t36Light);

  // Dark:
  const t18Dark = colorMix(fill, "#0C0C0C", 18);
  const crT18Dark = contrast(darkTx, t18Dark);
  const t36Dark = colorMix(fill, "#0C0C0C", 36);
  const crT36Dark = contrast(darkTx, t36Dark);

  const ok =
    crInk >= 4.5 &&
    crT18Light >= 4.5 &&
    crT36Light >= 4.5 &&
    crT18Dark >= 4.5 &&
    crT36Dark >= 4.5;

  return {
    name,
    fill,
    ink,
    crInk: crInk.toFixed(2),
    crT18Light: crT18Light.toFixed(2),
    crT36Light: crT36Light.toFixed(2),
    crT18Dark: crT18Dark.toFixed(2),
    crT36Dark: crT36Dark.toFixed(2),
    ok,
  };
}

console.log("\nVerifying 17 Base Preview entries:");
for (const [name, pair] of Object.entries(BASE_PAL)) {
  const res = verifyPair(name, pair);
  if (!res.ok) {
    console.log(`FAIL: ${name}`, res);
  } else {
    console.log(`  PASS: ${name} (ink=${res.crInk}, T18L=${res.crT18Light}, T36L=${res.crT36Light}, T18D=${res.crT18Dark}, T36D=${res.crT36Dark})`);
  }
}
