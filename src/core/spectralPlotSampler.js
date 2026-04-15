/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import Simulator from './Simulator.js';
import { interpolateNTabulated } from './materials/evaluateMaterial.js';
import { spdValueAtStandard } from './spectralPresets.js';
import { dichroicLinearEdgeReflectance, planckSpectralRadianceNm } from './spectral.js';
import { sampleCurve } from './curveSamples.js';

const LIGHT_TYPES = new Set(['PointSource', 'AngleSource', 'Beam', 'SingleRay']);
const STANDARD_MODES = ['led', 'fluorescent', 'sodium_vapor', 'mercury_vapor', 'xenon_arc'];
const PLOT_SAMPLES = 320;

/**
 * @typedef {{ x: number, y: number }} PlotPoint
 * @typedef {{ label: string, color?: string, points: PlotPoint[] }} PlotSeries
 * @typedef {{ title: string, yLabel: string, series: PlotSeries[] }} SpectralPlotPanel
 * @typedef {{ title: string, subtitle?: string, panels: SpectralPlotPanel[] }|null} SpectralPlotPayload
 */

/**
 * @param {import('./Scene.js').default} scene
 * @param {*} obj
 * @returns {number}
 */
function relativeEmissionAtLambda(scene, obj, lam) {
  const mode = obj.spectralMode || 'mono';
  const opt = {
    blackbodyTempK: obj.blackbodyTempK,
    ledPeakNm: obj.ledPeakNm,
    ledFwhmNm: obj.ledFwhmNm,
    fluorescentPreset: obj.fluorescentPreset,
    sodiumPreset: obj.sodiumPreset
  };
  if (mode === 'mono') {
    return Math.abs(lam - (obj.wavelength || Simulator.GREEN_WAVELENGTH)) <= 1.5 ? 1 : 0;
  }
  if (mode === 'uniform') {
    return 1;
  }
  if (mode === 'tabular') {
    const w = obj.spectralWavelengths || [];
    const p = obj.spectralPower || [];
    if (w.length < 2) {
      return 0;
    }
    const v = interpolateNTabulated(lam, w, p);
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  }
  if (mode === 'blackbody') {
    return planckSpectralRadianceNm(lam, Number(opt.blackbodyTempK) || 5500);
  }
  if (STANDARD_MODES.includes(mode)) {
    return spdValueAtStandard(mode, opt, lam);
  }
  return 0;
}

/**
 * @param {import('./Scene.js').default} scene
 * @param {*} obj
 * @returns {SpectralPlotPayload}
 */
function buildEmissionPlot(scene, obj) {
  const uv = Simulator.UV_WAVELENGTH;
  const ir = Simulator.INFRARED_WAVELENGTH;
  const series = [];
  let maxY = 0;
  for (let i = 0; i <= PLOT_SAMPLES; i++) {
    const lam = uv + (i / PLOT_SAMPLES) * (ir - uv);
    const y = relativeEmissionAtLambda(scene, obj, lam);
    maxY = Math.max(maxY, y);
    series.push({ x: lam, y });
  }
  if (maxY > 0) {
    for (const p of series) {
      p.y /= maxY;
    }
  }
  const label = obj.constructor?.type || 'Light source';
  const mode = obj.spectralMode || 'mono';
  const modeLabel = mode === 'uniform' ? 'White' : mode;
  return {
    title: `${label} — emission (relative)`,
    subtitle: `Mode: ${modeLabel}`,
    panels: [
      {
        title: 'Spectral power distribution',
        yLabel: 'Relative power (max = 1)',
        series: [{ label: 'Emission', color: '#e36414', points: series }]
      }
    ]
  };
}

/**
 * @param {*} glass
 * @returns {SpectralPlotPayload}
 */
function buildIndexPlot(scene, glass) {
  const uv = Simulator.UV_WAVELENGTH;
  const ir = Simulator.INFRARED_WAVELENGTH;
  const pt =
    typeof glass.getDefaultCenter === 'function'
      ? glass.getDefaultCenter()
      : { x: 0, y: 0 };
  const points = [];
  for (let i = 0; i <= PLOT_SAMPLES; i++) {
    const lam = uv + (i / PLOT_SAMPLES) * (ir - uv);
    const ray = { wavelength: lam };
    const n = glass.getRefIndexAt(pt, ray);
    points.push({ x: lam, y: Number.isFinite(n) ? n : NaN });
  }
  const label = glass.constructor?.type || 'Glass';
  const mat = glass.materialId && (scene.materialLibrary || {})[glass.materialId];
  const sub = mat
    ? `Material library: ${glass.materialId}`
    : glass.scene.simulateColors
      ? 'Cauchy A + B / λ² (unless material preset)'
      : 'Constant index (monochromatic mode uses no dispersion here)';
  return {
    title: `${label} — refractive index`,
    subtitle: sub,
    panels: [
      {
        title: 'n(λ)',
        yLabel: 'n',
        series: [{ label: 'n(λ)', color: '#0d6efd', points }]
      }
    ]
  };
}

/**
 * Binary filter pass probability (legacy band), same logic as visual “inside band”.
 * @param {number} lam
 * @param {*} obj
 */
function legacyBandPass(lam, obj) {
  const center = obj.wavelength ?? Simulator.GREEN_WAVELENGTH;
  const bw = obj.bandwidth ?? 0;
  const inside = Math.abs(lam - center) <= bw;
  return obj.invert ? (inside ? 0 : 1) : inside ? 1 : 0;
}

/**
 * @param {import('./Scene.js').default} scene
 * @param {*} obj
 * @returns {SpectralPlotPayload}
 */
function buildFilterFamilyPlot(scene, obj) {
  const uv = Simulator.UV_WAVELENGTH;
  const ir = Simulator.INFRARED_WAVELENGTH;
  /** @type {SpectralPlotPanel[]} */
  const panels = [];

  if (obj.spectralReflectance && obj.reflectanceWavelengths?.length >= 2) {
    const pts = [];
    for (let i = 0; i <= PLOT_SAMPLES; i++) {
      const lam = uv + (i / PLOT_SAMPLES) * (ir - uv);
      let R = sampleCurve(lam, obj.reflectanceWavelengths, obj.reflectanceValues, 0);
      R = Math.max(0, Math.min(1, R));
      if (obj.invert) {
        R = 1 - R;
      }
      pts.push({ x: lam, y: R });
    }
    panels.push({
      title: obj.invert ? 'Effective reflectance R′(λ) (tabular R inverted)' : 'Spectral reflectance R(λ)',
      yLabel: 'Reflectance R',
      series: [{ label: obj.invert ? 'R′(λ)' : 'R(λ)', color: '#6f42c1', points: pts }]
    });
    const tpts = pts.map((p) => ({ x: p.x, y: 1 - p.y }));
    panels.push({
      title: 'Transmittance (1 − R) along mirror normal',
      yLabel: 'T',
      series: [{ label: '1 − R(λ)', color: '#198754', points: tpts }]
    });
  }

  if (
    obj.spectralReflectance &&
    obj.mirrorSpectralMode === 'dichroic' &&
    !(obj.reflectanceWavelengths?.length >= 2)
  ) {
    const pts = [];
    for (let i = 0; i <= PLOT_SAMPLES; i++) {
      const lam = uv + (i / PLOT_SAMPLES) * (ir - uv);
      const R = dichroicLinearEdgeReflectance(lam, obj.wavelength, obj.bandwidth, obj.invert);
      pts.push({ x: lam, y: R });
    }
    panels.push({
      title: 'Dichroic linear edge R(λ)',
      yLabel: 'Reflectance R',
      series: [{ label: 'R(λ) edge', color: '#6f42c1', points: pts }]
    });
    const tpts = pts.map((p) => ({ x: p.x, y: 1 - p.y }));
    panels.push({
      title: 'Transmittance (1 − R) along mirror normal',
      yLabel: 'T',
      series: [{ label: '1 − R(λ)', color: '#198754', points: tpts }]
    });
  }

  if (obj.spectralExtinction && obj.extinctionWavelengths?.length >= 2) {
    const kpts = [];
    const Tpts = [];
    const d = Math.max(0, obj.filterThicknessMm ?? 1);
    for (let i = 0; i <= PLOT_SAMPLES; i++) {
      const lam = uv + (i / PLOT_SAMPLES) * (ir - uv);
      const k = Math.max(0, sampleCurve(lam, obj.extinctionWavelengths, obj.extinctionK, 0));
      const T = Math.exp(-k * d);
      kpts.push({ x: lam, y: k });
      Tpts.push({ x: lam, y: T });
    }
    panels.push({
      title: 'Extinction k(λ)',
      yLabel: 'k (1/mm scale · model units)',
      series: [{ label: 'k(λ)', color: '#dc3545', points: kpts }]
    });
    panels.push({
      title: `Beer–Lambert transmittance T(λ) = e^{−k·d}, d = ${d} mm`,
      yLabel: 'T',
      series: [{ label: 'T(λ)', color: '#fd7e14', points: Tpts }]
    });
  }

  const hasSpectral = obj.spectralReflectance || obj.spectralExtinction;
  if (!hasSpectral && obj.wavelength != null && obj.bandwidth != null) {
    const bpts = [];
    for (let i = 0; i <= PLOT_SAMPLES; i++) {
      const lam = uv + (i / PLOT_SAMPLES) * (ir - uv);
      bpts.push({ x: lam, y: legacyBandPass(lam, obj) });
    }
    panels.push({
      title: obj.invert
        ? 'Rectangular band-stop (reflect outside center ± bandwidth)'
        : 'Rectangular band-pass (reflect inside center ± bandwidth)',
      yLabel: 'Approx. (1 = reflects)',
      series: [{ label: 'Simple band model', color: '#20c997', points: bpts }]
    });
  }

  if (panels.length === 0) {
    return null;
  }

  const t = obj.constructor?.type || 'Filter';
  return {
    title: `${t} — wavelength response`,
    subtitle:
      'UV–IR follows simulator band. Dichroic mirror: default linear edge from center ± bandwidth; optional JSON tabular R(λ) overrides.',
    panels
  };
}

/**
 * Build plot payload for the object bar “Spectral plot” action.
 * @param {import('./Scene.js').default} scene
 * @param {*} obj
 * @returns {SpectralPlotPayload}
 */
export function buildSpectralPlotData(scene, obj) {
  if (!scene || !scene.simulateColors) {
    return null;
  }
  const t = obj.constructor?.type;
  if (LIGHT_TYPES.has(t)) {
    return buildEmissionPlot(scene, obj);
  }
  if (typeof obj.getRefIndexAt === 'function') {
    return buildIndexPlot(scene, obj);
  }
  if (typeof obj.checkRayIntersectFilter === 'function') {
    const hasR = !!(obj.spectralReflectance && obj.reflectanceWavelengths?.length >= 2);
    const hasK = !!(obj.spectralExtinction && obj.extinctionWavelengths?.length >= 2);
    const hasAnalyticDichroic =
      obj.mirrorSpectralMode === 'dichroic' &&
      obj.spectralReflectance &&
      !(obj.reflectanceWavelengths?.length >= 2);
    if (obj.filter || hasR || hasK || hasAnalyticDichroic) {
      return buildFilterFamilyPlot(scene, obj);
    }
  }
  return null;
}

/**
 * Whether the spectral plot button should appear for this object (cheap check).
 * @param {import('./Scene.js').default} scene
 * @param {*} obj
 * @returns {boolean}
 */
export function hasSpectralPlotContent(scene, obj) {
  if (!scene?.simulateColors) {
    return false;
  }
  const t = obj.constructor?.type;
  if (LIGHT_TYPES.has(t)) {
    return true;
  }
  if (typeof obj.getRefIndexAt === 'function') {
    return true;
  }
  if (typeof obj.checkRayIntersectFilter === 'function') {
    const hasR = !!(obj.spectralReflectance && obj.reflectanceWavelengths?.length >= 2);
    const hasK = !!(obj.spectralExtinction && obj.extinctionWavelengths?.length >= 2);
    const hasAnalyticDichroic =
      obj.mirrorSpectralMode === 'dichroic' &&
      obj.spectralReflectance &&
      !(obj.reflectanceWavelengths?.length >= 2);
    if (hasR || hasK || hasAnalyticDichroic) {
      return true;
    }
    if (obj.filter && obj.wavelength != null && obj.bandwidth != null) {
      return true;
    }
  }
  return false;
}
