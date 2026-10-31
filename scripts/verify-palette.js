#!/usr/bin/env node

/**
 * Palette Verification Script for Raphragrance (Swatch Design)
 *
 * Enforces the 3 contrast rules from Section 3:
 * 1. `--i` on `--c` has contrast >= 4.5:1.
 * 2. Page ink (`--tx`) on `color-mix(in srgb, --c 18%, --bg)` and
 *    on `color-mix(in srgb, --c 36%, --bg)` has contrast >= 4.5:1
 *    (these are the Top and Heart bands) in BOTH light and dark themes.
 * 3. `--mu` on `--bg` >= 4.5:1 in BOTH light and dark themes.
 */

const fs = require("fs");
const path = require("path");

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

const TOKENS = {
  light: {
    bg: "#FFFFFF",
    tx: "#0E0E0E",
    mu: "#5F5F5A",
    line: "#E4E4DF",
    ph: "#8A8A85",
  },
  dark: {
    bg: "#0C0C0C",
    tx: "#F2F2EF",
    mu: "#9A9A95",
    line: "#242422",
    ph: "#6A6A66",
  },
};

const PAL = {
  // Greens
  aromatic: ["#3F6F4A", "#F4F7F2"],
  "fresh spicy": ["#1F5D50", "#F2EFE6"],
  green: ["#769E26", "#121A04"],

  // Browns / Resins
  woody: ["#7B4B2A", "#F7EFE6"],
  leather: ["#4A2E22", "#F3E8DF"],
  oud: ["#412635", "#F7EDF3"],
  patchouli: ["#5F572E", "#F9F6EA"],

  // Reds / Oranges
  fruity: ["#E4572E", "#140A05"],
  "warm spicy": ["#A8401F", "#FBF0E8"],

  // Yellows / Golds
  citrus: ["#F0C419", "#1E1800"],
  amber: ["#E0A030", "#1C1406"],
  vanilla: ["#EFE0BC", "#2A2012"],

  // Pinks / Floral
  floral: ["#E58FA8", "#2A0F18"],
  "white floral": ["#F0DDE4", "#2B1A21"],
  sweet: ["#D9577A", "#1A0710"],
  rose: ["#961A3C", "#FCF0F3"],

  // Purples
  powdery: ["#D5C8E0", "#221A2C"],
  lavender: ["#6E5B8E", "#F7F4FC"],

  // Blue-Greys / Aquatics
  aldehydic: ["#CFDBE0", "#14232B"],
  marine: ["#1D5F7C", "#EDF6F9"],
  fresh: ["#62C0D0", "#081F26"],

  // Neutrals
  musky: ["#B8A9A0", "#1F1915"],
  smoky: ["#4A4A52", "#F0F0F2"],
};

const DEF = ["#7E8284", "#0E0E0E"];

function runVerification() {
  console.log("=================================================");
  console.log(" Raphragrance Palette & Contrast Verification");
  console.log("=================================================\n");

  let failures = 0;

  // Rule 3: --mu on --bg >= 4.5 in both themes
  console.log("Rule 3: --mu on --bg >= 4.5:1");
  for (const theme of ["light", "dark"]) {
    const t = TOKENS[theme];
    const cr = contrast(hexToRgb(t.mu), hexToRgb(t.bg));
    const pass = cr >= 4.5;
    console.log(
      `  [${pass ? "PASS" : "FAIL"}] ${theme.padEnd(5)}: ${t.mu} on ${t.bg} = ${cr.toFixed(2)}:1 (threshold 4.5:1)`
    );
    if (!pass) failures++;
  }

  // Also check placeholder >= 3.0:1 (Section 1)
  console.log("\nToken check: --ph on --bg >= 3.0:1");
  for (const theme of ["light", "dark"]) {
    const t = TOKENS[theme];
    const cr = contrast(hexToRgb(t.ph), hexToRgb(t.bg));
    const pass = cr >= 3.0;
    console.log(
      `  [${pass ? "PASS" : "FAIL"}] ${theme.padEnd(5)}: ${t.ph} on ${t.bg} = ${cr.toFixed(2)}:1 (threshold 3.0:1)`
    );
    if (!pass) failures++;
  }

  console.log("\nRules 1 & 2: Accord Palette Pairs (24 entries + DEF):");
  console.log(
    "Name".padEnd(16) +
      "Fill".padEnd(10) +
      "Ink".padEnd(10) +
      "Ink/Fill".padEnd(10) +
      "Top(L)".padEnd(8) +
      "Hrt(L)".padEnd(8) +
      "Top(D)".padEnd(8) +
      "Hrt(D)".padEnd(8) +
      "Status"
  );
  console.log("-".repeat(84));

  const allPairs = { ...PAL, DEF };

  for (const [name, [fill, ink]] of Object.entries(allPairs)) {
    const cRgb = hexToRgb(fill);
    const iRgb = hexToRgb(ink);

    // Rule 1: --i on --c >= 4.5
    const crInk = contrast(iRgb, cRgb);

    // Rule 2: --tx on 18% & 36% tint in light and dark
    const crTopL = contrast(hexToRgb(TOKENS.light.tx), colorMix(fill, TOKENS.light.bg, 18));
    const crHrtL = contrast(hexToRgb(TOKENS.light.tx), colorMix(fill, TOKENS.light.bg, 36));
    const crTopD = contrast(hexToRgb(TOKENS.dark.tx), colorMix(fill, TOKENS.dark.bg, 18));
    const crHrtD = contrast(hexToRgb(TOKENS.dark.tx), colorMix(fill, TOKENS.dark.bg, 36));

    const pass =
      crInk >= 4.5 &&
      crTopL >= 4.5 &&
      crHrtL >= 4.5 &&
      crTopD >= 4.5 &&
      crHrtD >= 4.5;

    if (!pass) failures++;

    console.log(
      name.padEnd(16) +
        fill.padEnd(10) +
        ink.padEnd(10) +
        (crInk.toFixed(2) + ":1").padEnd(10) +
        crTopL.toFixed(1).padEnd(8) +
        crHrtL.toFixed(1).padEnd(8) +
        crTopD.toFixed(1).padEnd(8) +
        crHrtD.toFixed(1).padEnd(8) +
        (pass ? "PASS" : "FAIL")
    );
  }

  console.log("-".repeat(84));
  if (failures > 0) {
    console.error(`\n❌ VERIFICATION FAILED: ${failures} check(s) did not meet WCAG contrast thresholds.`);
    process.exit(1);
  } else {
    console.log(`\n✅ ALL CHECKS PASSED: 24 accords + DEF conform to 100% of contrast rules in both themes.\n`);
  }
}

if (require.main === module) {
  runVerification();
}

module.exports = {
  srgbLuminance,
  hexToRgb,
  contrast,
  colorMix,
  TOKENS,
  PAL,
  DEF,
  runVerification,
};
