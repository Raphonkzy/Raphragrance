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
const darkBg = hexToRgb("#0C0C0C");
const darkTx = hexToRgb("#F2F2EF");

function testCandidate(name, fill, ink) {
  const cRgb = hexToRgb(fill);
  const iRgb = hexToRgb(ink);

  const crInk = contrast(iRgb, cRgb);
  const crT18L = contrast(lightTx, colorMix(fill, "#FFFFFF", 18));
  const crT36L = contrast(lightTx, colorMix(fill, "#FFFFFF", 36));
  const crT18D = contrast(darkTx, colorMix(fill, "#0C0C0C", 18));
  const crT36D = contrast(darkTx, colorMix(fill, "#0C0C0C", 36));

  const pass =
    crInk >= 4.5 &&
    crT18L >= 4.5 &&
    crT36L >= 4.5 &&
    crT18D >= 4.5 &&
    crT36D >= 4.5;

  console.log(
    `${pass ? "PASS" : "FAIL"}: ${name.padEnd(12)} fill=${fill} ink=${ink} | ink=${crInk.toFixed(2)} T18L=${crT18L.toFixed(2)} T36L=${crT36L.toFixed(2)} T18D=${crT18D.toFixed(2)} T36D=${crT36D.toFixed(2)}`
  );
  return pass;
}

console.log("Testing DEF:");
testCandidate("DEF", "#D9D9D4", "#161614");

console.log("\nTesting Candidates for New Accords:");
testCandidate("rose", "#BF3354", "#FAF0F2");
testCandidate("green", "#4B7332", "#F4F8EE");
testCandidate("oud", "#593626", "#F6EEE8");
testCandidate("lavender", "#786596", "#FAF6FD");
testCandidate("marine", "#24667D", "#EEF6F8");
testCandidate("fresh", "#A2C7D4", "#112026");
testCandidate("patchouli", "#6C523B", "#FAF3EB");
