/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 */

import { interpolateNTabulated } from './materials/evaluateMaterial.js';

/**
 * @param {number} lambdaNm
 * @param {number[]|undefined} wavelengths
 * @param {number[]|undefined} values
 * @param {number} fallback
 * @returns {number}
 */
export function sampleCurve(lambdaNm, wavelengths, values, fallback = 0) {
  if (!wavelengths?.length || wavelengths.length !== values?.length || wavelengths.length < 2) {
    return fallback;
  }
  const v = interpolateNTabulated(lambdaNm, wavelengths, values);
  return Number.isFinite(v) ? v : fallback;
}
