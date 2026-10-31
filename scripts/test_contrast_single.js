const { hexToRgb } = require("./ciede2000");
const { contrast, colorMix, TOKENS } = require("./verify-palette");

function verifyContrast(fill, ink) {
  const cRgb = hexToRgb(fill);
  const iRgb = hexToRgb(ink);

  const crInk = contrast(iRgb, cRgb);
  const crTopL = contrast(hexToRgb(TOKENS.light.tx), colorMix(fill, TOKENS.light.bg, 18));
  const crHrtL = contrast(hexToRgb(TOKENS.light.tx), colorMix(fill, TOKENS.light.bg, 36));
  const crTopD = contrast(hexToRgb(TOKENS.dark.tx), colorMix(fill, TOKENS.dark.bg, 18));
  const crHrtD = contrast(hexToRgb(TOKENS.dark.tx), colorMix(fill, TOKENS.dark.bg, 36));

  const pass = crInk >= 4.5 && crTopL >= 4.5 && crHrtL >= 4.5 && crTopD >= 4.5 && crHrtD >= 4.5;
  return { pass, crInk, crTopL, crHrtL, crTopD, crHrtD };
}

module.exports = { verifyContrast };
