/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { interpolateNTabulated } from './materials/evaluateMaterial.js';

/**
 * FWHM (nm) to Gaussian sigma.
 * @param {number} fwhmNm
 * @returns {number}
 */
function fwhmToSigma(fwhmNm) {
  return fwhmNm / (2 * Math.sqrt(2 * Math.log(2)));
}

/**
 * @param {number} lamNm
 * @param {number} centerNm
 * @param {number} sigmaNm
 */
function gaussian(lamNm, centerNm, sigmaNm) {
  if (sigmaNm <= 0) {
    return 0;
  }
  return Math.exp(-0.5 * Math.pow((lamNm - centerNm) / sigmaNm, 2));
}

/** Approximate tri-band / office fluorescent shapes (relative, unnormalized). */
const FLUORESCENT_TABLES = {
  cool_white: {
    wavelengths: [380, 430, 480, 540, 580, 620, 680],
    power: [0.15, 0.55, 0.75, 0.95, 0.7, 0.45, 0.2]
  },
  warm_white: {
    wavelengths: [380, 430, 500, 560, 600, 640, 700],
    power: [0.08, 0.2, 0.45, 0.75, 0.95, 0.85, 0.45]
  },
  daylight: {
    wavelengths: [380, 440, 500, 550, 600, 650, 700],
    power: [0.25, 0.45, 0.8, 0.95, 0.85, 0.65, 0.35]
  },
  tri_phosphor: {
    wavelengths: [380, 450, 520, 590, 620, 680],
    power: [0.2, 0.85, 0.75, 0.95, 0.55, 0.15]
  }
};

function fluorescentSpd(preset, lamNm) {
  const key = preset && FLUORESCENT_TABLES[preset] ? preset : 'cool_white';
  const t = FLUORESCENT_TABLES[key];
  const v = interpolateNTabulated(lamNm, t.wavelengths, t.power);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

function sodiumSpd(preset, lamNm) {
  if (preset === 'hps') {
    return (
      0.75 * gaussian(lamNm, 598, 35) +
      0.2 * gaussian(lamNm, 615, 45) +
      0.05 * gaussian(lamNm, 640, 60)
    );
  }
  return (
    0.55 * gaussian(lamNm, 589.0, 0.45) +
    0.45 * gaussian(lamNm, 589.6, 0.45)
  );
}

/** Strong Hg lines (nm) and relative weights — illustrative for discharge lamps. */
const MERCURY_LINES = [
  [404.7, 0.12],
  [435.8, 0.18],
  [546.1, 0.48],
  [577.0, 0.1],
  [579.1, 0.1]
];

function mercurySpd(lamNm) {
  let s = 0;
  for (const [wl, w] of MERCURY_LINES) {
    s += w * gaussian(lamNm, wl, 1.8);
  }
  return s;
}

function xenonSpd(lamNm) {
  if (lamNm < 360 || lamNm > 780) {
    return 0.02;
  }
  const u = (lamNm - 400) / 320;
  return 0.75 + 0.25 * Math.sin(Math.max(0, Math.min(1, u)) * Math.PI * 0.5);
}

/**
 * Relative spectral power at λ (nm) for standard source modes.
 * @param {'led'|'fluorescent'|'sodium_vapor'|'mercury_vapor'|'xenon_arc'} mode
 * @param {{ ledPeakNm?: number, ledFwhmNm?: number, fluorescentPreset?: string, sodiumPreset?: string }} opt
 * @param {number} lambdaNm
 * @returns {number}
 */
export function spdValueAtStandard(mode, opt, lambdaNm) {
  const lam = lambdaNm;
  const o = opt || {};
  if (mode === 'led') {
    const peak = Number(o.ledPeakNm);
    const peakNm = Number.isFinite(peak) ? peak : 550;
    const fwhm = Math.max(0.5, Number(o.ledFwhmNm) || 30);
    const sigma = fwhmToSigma(fwhm);
    return gaussian(lam, peakNm, sigma);
  }
  if (mode === 'fluorescent') {
    return fluorescentSpd(o.fluorescentPreset, lam);
  }
  if (mode === 'sodium_vapor') {
    return sodiumSpd(o.sodiumPreset === 'hps' ? 'hps' : 'lps', lam);
  }
  if (mode === 'mercury_vapor') {
    return mercurySpd(lam);
  }
  if (mode === 'xenon_arc') {
    return xenonSpd(lam);
  }
  return 0;
}
