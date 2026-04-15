/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 */

import { buildSpectralBins, buildSourceBands } from './spectral.js';

/**
 * @param {import('./Scene.js').default} scene
 * @param {{ wavelength: number, spectralMode?: string, spectralWavelengths?: number[], spectralPower?: number[], blackbodyTempK?: number, ledPeakNm?: number, ledFwhmNm?: number, fluorescentPreset?: string, sodiumPreset?: string }} obj
 * @returns {{ wavelength: number, weight: number }[]}
 */
export function getSpectralBandsForSource(scene, obj) {
  if (!scene.simulateColors || !obj.spectralMode || obj.spectralMode === 'mono') {
    return [{ wavelength: obj.wavelength, weight: 1 }];
  }
  const bins = buildSpectralBins(scene);
  const spectralOptions = {
    blackbodyTempK: obj.blackbodyTempK,
    ledPeakNm: obj.ledPeakNm,
    ledFwhmNm: obj.ledFwhmNm,
    fluorescentPreset: obj.fluorescentPreset,
    sodiumPreset: obj.sodiumPreset
  };
  return buildSourceBands(
    obj.spectralMode,
    obj.wavelength,
    obj.spectralWavelengths || [],
    obj.spectralPower || [],
    spectralOptions,
    bins
  );
}
