const { hexToLab, ciede2000, hexToRgb } = require("./ciede2000");
const { contrast, colorMix, TOKENS } = require("./verify-palette");

function check(fill, ink) {
  const cRgb = hexToRgb(fill);
  const iRgb = hexToRgb(ink);

  const crInk = contrast(iRgb, cRgb);
  const crTopL = contrast(hexToRgb(TOKENS.light.tx), colorMix(fill, TOKENS.light.bg, 18));
  const crHrtL = contrast(hexToRgb(TOKENS.light.tx), colorMix(fill, TOKENS.light.bg, 36));
  const crTopD = contrast(hexToRgb(TOKENS.dark.tx), colorMix(fill, TOKENS.dark.bg, 18));
  const crHrtD = contrast(hexToRgb(TOKENS.dark.tx), colorMix(fill, TOKENS.dark.bg, 36));

  const pass = crInk >= 4.5 && crTopL >= 4.5 && crHrtL >= 4.5 && crTopD >= 4.5 && crHrtD >= 4.5;
  console.log(fill, ink, "pass:", pass, `crInk=${crInk.toFixed(2)}, crTopL=${crTopL.toFixed(1)}, crHrtL=${crHrtL.toFixed(1)}, crTopD=${crTopD.toFixed(1)}, crHrtD=${crHrtD.toFixed(1)}`);
}

check("#158597", "#EFF9FA");
check("#127585", "#EFF8FA");
check("#0F6B7A", "#EEF7F9");
check("#7ACAD8", "#0B2228");
check("#62C0D0", "#081F26");
check("#53B8C9", "#061B22");
check("#41ADC0", "#061A20");
