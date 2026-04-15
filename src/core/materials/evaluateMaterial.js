/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

/**
 * @typedef {Object} MaterialDefinition
 * @property {'constant'|'tabulated'|'sellmeier'} kind
 * @property {number} [n] - for constant
 * @property {number[]} [wavelengths] - nm, ascending, for tabulated
 * @property {number[]} [nValues] - same length as wavelengths
 * @property {number[]} [B] - Sellmeier B coefficients (µm^2 scale)
 * @property {number[]} [C] - Sellmeier C coefficients (µm^2)
 */

/**
 * Linear interpolation of n(λ) from tabulated data.
 * @param {number} lambdaNm
 * @param {number[]} wavelengths
 * @param {number[]} nValues
 * @returns {number}
 */
export function interpolateNTabulated(lambdaNm, wavelengths, nValues) {
  if (!wavelengths?.length || wavelengths.length !== nValues?.length) {
    return NaN;
  }
  const x = lambdaNm;
  if (x <= wavelengths[0]) {
    return nValues[0];
  }
  if (x >= wavelengths[wavelengths.length - 1]) {
    return nValues[nValues.length - 1];
  }
  let lo = 0;
  let hi = wavelengths.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (wavelengths[mid] <= x) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const t = (x - wavelengths[lo]) / (wavelengths[hi] - wavelengths[lo]);
  return nValues[lo] + t * (nValues[hi] - nValues[lo]);
}

/**
 * Sellmeier-2 form: n^2(λ) = 1 + Σ B_i λ^2 / (λ^2 - C_i) with λ in micrometers.
 * @param {number} lambdaNm
 * @param {number[]} B
 * @param {number[]} C
 * @returns {number}
 */
export function sellmeierN(lambdaNm, B, C) {
  const lamUm = lambdaNm * 1e-3;
  const lam2 = lamUm * lamUm;
  let n2 = 1;
  for (let i = 0; i < B.length; i++) {
    const Ci = C[i];
    if (Math.abs(lam2 - Ci) < 1e-18) {
      return NaN;
    }
    n2 += (B[i] * lam2) / (lam2 - Ci);
  }
  if (n2 <= 0) {
    return NaN;
  }
  return Math.sqrt(n2);
}

/**
 * @param {MaterialDefinition} def
 * @param {number} lambdaNm
 * @returns {number}
 */
export function materialNAt(def, lambdaNm) {
  if (!def || !Number.isFinite(lambdaNm)) {
    return NaN;
  }
  if (def.kind === 'constant') {
    return def.n;
  }
  if (def.kind === 'tabulated') {
    return interpolateNTabulated(lambdaNm, def.wavelengths, def.nValues);
  }
  if (def.kind === 'sellmeier') {
    return sellmeierN(lambdaNm, def.B, def.C);
  }
  return NaN;
}

/**
 * Resolve n from scene material library or fall back to Cauchy on the glass object.
 * @param {import('../Scene.js').default} scene
 * @param {string} materialId
 * @param {number} lambdaNm
 * @param {number} cauchyA
 * @param {number} cauchyB
 * @param {boolean} useCauchy
 * @returns {number}
 */
export function nFromMaterialOrCauchy(scene, materialId, lambdaNm, cauchyA, cauchyB, useCauchy) {
  const lib = scene.materialLibrary || {};
  const def = materialId && lib[materialId];
  if (def) {
    const n = materialNAt(def, lambdaNm);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  if (useCauchy) {
    return cauchyA + cauchyB / (lambdaNm * lambdaNm * 0.000001);
  }
  return cauchyA;
}
