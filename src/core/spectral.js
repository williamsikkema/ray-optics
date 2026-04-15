/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import Simulator from './Simulator.js';
import { spdValueAtStandard } from './spectralPresets.js';

const MAX_BINS = 5000;

/**
 * @param {import('./Scene.js').default} scene
 * @returns {{ lo: number, hi: number, wavelength: number }[]}
 */
export function buildSpectralBins(scene) {
  const uv = Simulator.UV_WAVELENGTH;
  const ir = Simulator.INFRARED_WAVELENGTH;
  let step = scene.spectralResolutionNm ?? 10;
  if (!Number.isFinite(step) || step <= 0) {
    step = 10;
  }
  let span = ir - uv;
  if (span <= 0) {
    span = 1;
  }
  let nEstimate = Math.ceil(span / step);
  if (nEstimate > MAX_BINS) {
    step = span / MAX_BINS;
  }
  const bins = [];
  for (let lo = uv; lo < ir - 1e-9; lo += step) {
    const hi = Math.min(lo + step, ir);
    bins.push({
      lo,
      hi,
      wavelength: (lo + hi) / 2,
    });
  }
  if (bins.length === 0) {
    bins.push({ lo: uv, hi: ir, wavelength: (uv + ir) / 2 });
  }
  return bins;
}

/**
 * Planck spectral radiance B_λ (relative), λ in meters, T in Kelvin.
 * @param {number} lambdaM
 * @param {number} T
 * @returns {number}
 */
function planckRelative(lambdaM, T) {
  const h = 6.62607015e-34;
  const c = 299792458;
  const k = 1.380649e-23;
  if (lambdaM <= 0 || T <= 0) {
    return 0;
  }
  const x = (h * c) / (lambdaM * k * T);
  if (x > 700) {
    return 0;
  }
  return (2 * h * c * c) / (Math.pow(lambdaM, 5) * (Math.exp(x) - 1));
}

/**
 * Planck spectral radiance (relative), λ in nanometers.
 * @param {number} lambdaNm
 * @param {number} T
 * @returns {number}
 */
export function planckSpectralRadianceNm(lambdaNm, T) {
  return planckRelative(lambdaNm * 1e-9, T);
}

/**
 * Integrate piecewise-linear SPD over [lo, hi]; wavelengths in nm.
 * @param {number} lo
 * @param {number} hi
 * @param {number[]} wavelengths
 * @param {number[]} power
 * @returns {number}
 */
export function integrateSpdBin(lo, hi, wavelengths, power) {
  if (!wavelengths?.length || wavelengths.length !== power?.length) {
    return hi - lo;
  }
  let sum = 0;
  const n = wavelengths.length;
  for (let i = 0; i < n - 1; i++) {
    const w0 = wavelengths[i];
    const w1 = wavelengths[i + 1];
    const p0 = power[i];
    const p1 = power[i + 1];
    const segLo = Math.max(lo, w0);
    const segHi = Math.min(hi, w1);
    if (segHi <= segLo) {
      continue;
    }
    if (w1 <= w0) {
      continue;
    }
    const t0 = (segLo - w0) / (w1 - w0);
    const t1 = (segHi - w0) / (w1 - w0);
    const v0 = p0 + t0 * (p1 - p0);
    const v1 = p0 + t1 * (p1 - p0);
    sum += 0.5 * (v0 + v1) * (segHi - segLo);
  }
  return sum;
}

/**
 * @param {'mono'|'uniform'|'tabular'|'blackbody'|'led'|'fluorescent'|'sodium_vapor'|'mercury_vapor'|'xenon_arc'} mode
 * @param {number} monoNm
 * @param {number[]} spdWavelengths
 * @param {number[]} spdPower
 * @param {{ blackbodyTempK?: number, ledPeakNm?: number, ledFwhmNm?: number, fluorescentPreset?: string, sodiumPreset?: string }|undefined} spectralOptions
 * @param {{ lo: number, hi: number, wavelength: number }[]} bins
 * @returns {{ wavelength: number, weight: number }[]}
 */
export function buildSourceBands(mode, monoNm, spdWavelengths, spdPower, spectralOptions, bins) {
  const opt = spectralOptions || {};
  if (!bins?.length) {
    return [{ wavelength: monoNm, weight: 1 }];
  }
  if (mode === 'mono' || !mode) {
    return [{ wavelength: monoNm, weight: 1 }];
  }

  const out = [];
  if (mode === 'uniform') {
    const w = 1 / bins.length;
    for (const b of bins) {
      out.push({ wavelength: b.wavelength, weight: w });
    }
    return out;
  }

  const STANDARD_MODES = ['led', 'fluorescent', 'sodium_vapor', 'mercury_vapor', 'xenon_arc'];

  let total = 0;
  const raw = [];
  for (const b of bins) {
    let p = 0;
    if (mode === 'tabular') {
      p = integrateSpdBin(b.lo, b.hi, spdWavelengths, spdPower);
    } else if (mode === 'blackbody') {
      const T = Number(opt.blackbodyTempK) || 5500;
      let s = 0;
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        const nm = b.lo + t * (b.hi - b.lo);
        const lamM = nm * 1e-9;
        s += planckRelative(lamM, T);
      }
      p = s / steps;
    } else if (STANDARD_MODES.includes(mode)) {
      let s = 0;
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        const nm = b.lo + t * (b.hi - b.lo);
        s += spdValueAtStandard(mode, opt, nm);
      }
      p = s / steps;
    }
    raw.push(p);
    total += p;
  }
  if (total <= 0 || !Number.isFinite(total)) {
    const w = 1 / bins.length;
    for (const b of bins) {
      out.push({ wavelength: b.wavelength, weight: w });
    }
    return out;
  }
  for (let i = 0; i < bins.length; i++) {
    out.push({
      wavelength: bins[i].wavelength,
      weight: raw[i] / total,
    });
  }
  return out;
}

/**
 * Dichroic mirror: linear ramp of reflectance between edge wavelengths.
 * R = 1 at λ = center − bandwidth, R = 0 at λ = center + bandwidth (longer λ transmits more).
 * `bandwidth` is the half-width of the ramp (same as filter “± bandwidth”).
 * If invert, use R′ = 1 − R (swap short/long behavior).
 * @param {number} lam
 * @param {number} centerNm
 * @param {number} halfWidthNm
 * @param {boolean} invert
 * @returns {number} R in [0, 1]
 */
export function dichroicLinearEdgeReflectance(lam, centerNm, halfWidthNm, invert) {
  const c = Number(centerNm);
  const center = Number.isFinite(c) ? c : Simulator.GREEN_WAVELENGTH;
  const bw = Math.max(0, Number(halfWidthNm) || 0);
  if (bw < 1e-6) {
    let R = lam <= center ? 1 : 0;
    if (invert) R = 1 - R;
    return Math.max(0, Math.min(1, R));
  }
  const lo = center - bw;
  const hi = center + bw;
  let R;
  if (lam <= lo) R = 1;
  else if (lam >= hi) R = 0;
  else R = (hi - lam) / (hi - lo);
  if (invert) R = 1 - R;
  return Math.max(0, Math.min(1, R));
}
