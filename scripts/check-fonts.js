const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
const requiredFonts = [
  'Gilroy-Regular.woff2',
  'Gilroy-Medium.woff2',
  'Gilroy-Bold.woff2',
];

const allowFallback = process.env.ALLOW_FALLBACK_FONT === 'true';

const missing = [];
for (const font of requiredFonts) {
  const fontPath = path.join(fontsDir, font);
  if (!fs.existsSync(fontPath)) {
    missing.push(font);
  }
}

if (missing.length > 0) {
  if (allowFallback) {
    console.warn(`[WARN] Missing Gilroy font files: ${missing.join(', ')}.`);
    console.warn('[WARN] ALLOW_FALLBACK_FONT=true is set; proceeding with system font fallback.');
    process.exit(0);
  } else {
    console.error('================================================================================');
    console.error('ERROR: Required Gilroy font files are missing from assets/fonts/:');
    missing.forEach((f) => console.error(`  - ${f}`));
    console.error('\nGilroy is a commercial typeface required for brand visual parity.');
    console.error('To resolve this:');
    console.error('  1. Place licensed .woff2 files in the assets/fonts/ directory:');
    console.error('     - Gilroy-Regular.woff2');
    console.error('     - Gilroy-Medium.woff2');
    console.error('     - Gilroy-Bold.woff2');
    console.error('  2. OR set ALLOW_FALLBACK_FONT=true in your environment to build with system fonts.');
    console.error('================================================================================');
    process.exit(1);
  }
}

console.log('✓ Gilroy font files verified in assets/fonts/:');
requiredFonts.forEach((f) => {
  const stat = fs.statSync(path.join(fontsDir, f));
  console.log(`  - ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
});
process.exit(0);
