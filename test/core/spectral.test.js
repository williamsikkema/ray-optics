/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {
  buildSpectralBins,
  dichroicLinearEdgeReflectance,
  integrateSpdBin,
  buildSourceBands
} from '../../src/core/spectral.js';

describe('spectral binning', () => {
  describe('buildSpectralBins', () => {
    it('uses spectralResolutionNm as step between UV and IR', () => {
      const scene = { spectralResolutionNm: 10 };
      const bins = buildSpectralBins(scene);
      expect(bins.length).toBeGreaterThan(0);
      expect(bins[0].lo).toBe(380);
      const last = bins[bins.length - 1];
      expect(last.hi).toBe(700);
      for (const b of bins) {
        expect(b.hi - b.lo).toBeLessThanOrEqual(10 + 1e-6);
        expect(b.wavelength).toBeCloseTo((b.lo + b.hi) / 2, 6);
      }
    });
  });

  describe('integrateSpdBin', () => {
    it('integrates a linear segment over a bin', () => {
      const w = [400, 600];
      const p = [0, 2];
      const area = integrateSpdBin(450, 550, w, p);
      expect(area).toBeCloseTo(100, 6);
    });
  });

  describe('buildSourceBands', () => {
    const bins = [
      { lo: 380, hi: 390, wavelength: 385 },
      { lo: 390, hi: 400, wavelength: 395 }
    ];

    it('mono returns single band', () => {
      const r = buildSourceBands('mono', 540, [], [], {}, bins);
      expect(r).toEqual([{ wavelength: 540, weight: 1 }]);
    });

    it('uniform splits weight evenly', () => {
      const r = buildSourceBands('uniform', 540, [], [], {}, bins);
      expect(r.length).toBe(2);
      const sum = r.reduce((a, b) => a + b.weight, 0);
      expect(sum).toBeCloseTo(1, 6);
    });

    it('tabular normalizes weights', () => {
      const r = buildSourceBands(
        'tabular',
        540,
        [380, 700],
        [1, 1],
        {},
        bins
      );
      expect(r.length).toBe(2);
      const sum = r.reduce((a, b) => a + b.weight, 0);
      expect(sum).toBeCloseTo(1, 6);
    });

    it('LED Gaussian normalizes weights', () => {
      const r = buildSourceBands(
        'led',
        540,
        [],
        [],
        { ledPeakNm: 550, ledFwhmNm: 30 },
        bins
      );
      expect(r.length).toBe(2);
      const sum = r.reduce((a, b) => a + b.weight, 0);
      expect(sum).toBeCloseTo(1, 6);
    });

    it('blackbody uses spectralOptions.blackbodyTempK', () => {
      const r = buildSourceBands('blackbody', 540, [], [], { blackbodyTempK: 6500 }, bins);
      expect(r.length).toBe(2);
      const sum = r.reduce((a, b) => a + b.weight, 0);
      expect(sum).toBeCloseTo(1, 6);
    });
  });

  describe('dichroicLinearEdgeReflectance', () => {
    it('ramps R from 1 at center−bw to 0 at center+bw', () => {
      const c = 500;
      const bw = 20;
      expect(dichroicLinearEdgeReflectance(480, c, bw, false)).toBe(1);
      expect(dichroicLinearEdgeReflectance(520, c, bw, false)).toBe(0);
      expect(dichroicLinearEdgeReflectance(500, c, bw, false)).toBeCloseTo(0.5, 6);
    });

    it('invert swaps high and low R sides', () => {
      const c = 500;
      const bw = 20;
      expect(dichroicLinearEdgeReflectance(480, c, bw, true)).toBe(0);
      expect(dichroicLinearEdgeReflectance(520, c, bw, true)).toBe(1);
    });
  });
});
