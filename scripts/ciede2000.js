/**
 * CIEDE2000 Color Difference implementation
 */

function hexToRgb(hex) {
  hex = hex.replace("#", "");
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function rgbToXyz(r, g, b) {
  const [sR, sG, sB] = [r, g, b].map((c) => {
    c = c / 255;
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  });

  // D65 standard illuminant
  const x = sR * 0.4124564 + sG * 0.3575761 + sB * 0.1804375;
  const y = sR * 0.2126729 + sG * 0.7151522 + sB * 0.072175;
  const z = sR * 0.0193339 + sG * 0.119192 + sB * 0.9503041;

  return [x * 100, y * 100, z * 100];
}

function xyzToLab(x, y, z) {
  // D65 reference white
  const xN = 95.047;
  const yN = 100.0;
  const zN = 108.883;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  const fx = f(x / xN);
  const fy = f(y / yN);
  const fz = f(z / zN);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return [L, a, b];
}

function hexToLab(hex) {
  const [r, g, b] = hexToRgb(hex);
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

function deg2rad(deg) {
  return (deg * Math.PI) / 180;
}

function rad2deg(rad) {
  return (rad * 180) / Math.PI;
}

function ciede2000(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const C_bar = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(C_bar, 7) / (Math.pow(C_bar, 7) + Math.pow(25, 7))));

  const a1_prime = (1 + G) * a1;
  const a2_prime = (1 + G) * a2;

  const C1_prime = Math.hypot(a1_prime, b1);
  const C2_prime = Math.hypot(a2_prime, b2);

  let h1_prime = rad2deg(Math.atan2(b1, a1_prime));
  if (h1_prime < 0) h1_prime += 360;

  let h2_prime = rad2deg(Math.atan2(b2, a2_prime));
  if (h2_prime < 0) h2_prime += 360;

  const delta_L_prime = L2 - L1;
  const delta_C_prime = C2_prime - C1_prime;

  let delta_h_prime = 0;
  if (C1_prime * C2_prime !== 0) {
    const diff = h2_prime - h1_prime;
    if (Math.abs(diff) <= 180) {
      delta_h_prime = diff;
    } else if (diff > 180) {
      delta_h_prime = diff - 360;
    } else {
      delta_h_prime = diff + 360;
    }
  }

  const delta_H_prime = 2 * Math.sqrt(C1_prime * C2_prime) * Math.sin(deg2rad(delta_h_prime / 2));

  const L_bar_prime = (L1 + L2) / 2;
  const C_bar_prime = (C1_prime + C2_prime) / 2;

  let h_bar_prime = 0;
  if (C1_prime * C2_prime !== 0) {
    const sum = h1_prime + h2_prime;
    if (Math.abs(h1_prime - h2_prime) <= 180) {
      h_bar_prime = sum / 2;
    } else if (sum < 360) {
      h_bar_prime = (sum + 360) / 2;
    } else {
      h_bar_prime = (sum - 360) / 2;
    }
  }

  const T =
    1 -
    0.17 * Math.cos(deg2rad(h_bar_prime - 30)) +
    0.24 * Math.cos(deg2rad(2 * h_bar_prime)) +
    0.32 * Math.cos(deg2rad(3 * h_bar_prime + 6)) -
    0.2 * Math.cos(deg2rad(4 * h_bar_prime - 63));

  const delta_theta = 30 * Math.exp(-Math.pow((h_bar_prime - 275) / 25, 2));
  const R_C = 2 * Math.sqrt(Math.pow(C_bar_prime, 7) / (Math.pow(C_bar_prime, 7) + Math.pow(25, 7)));
  const S_L = 1 + (0.015 * Math.pow(L_bar_prime - 50, 2)) / Math.sqrt(20 + Math.pow(L_bar_prime - 50, 2));
  const S_C = 1 + 0.045 * C_bar_prime;
  const S_H = 1 + 0.015 * C_bar_prime * T;
  const R_T = -Math.sin(deg2rad(2 * delta_theta)) * R_C;

  const k_L = 1;
  const k_C = 1;
  const k_H = 1;

  const delta_E = Math.sqrt(
    Math.pow(delta_L_prime / (k_L * S_L), 2) +
      Math.pow(delta_C_prime / (k_C * S_C), 2) +
      Math.pow(delta_H_prime / (k_H * S_H), 2) +
      R_T * (delta_C_prime / (k_C * S_C)) * (delta_H_prime / (k_H * S_H))
  );

  return delta_E;
}

module.exports = {
  hexToLab,
  ciede2000,
  hexToRgb,
};
