/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {
  interpolateNTabulated,
  sellmeierN,
  materialNAt,
  nFromMaterialOrCauchy
} from '../../src/core/materials/evaluateMaterial.js';

describe('evaluateMaterial', () => {
  describe('interpolateNTabulated', () => {
    it('interpolates between tabulated points', () => {
      const w = [400, 500, 600];
      const n = [1.5, 1.51, 1.52];
      expect(interpolateNTabulated(400, w, n)).toBeCloseTo(1.5, 6);
      expect(interpolateNTabulated(500, w, n)).toBeCloseTo(1.51, 6);
      expect(interpolateNTabulated(450, w, n)).toBeCloseTo(1.505, 6);
    });

    it('clamps outside the table', () => {
      const w = [400, 600];
      const n = [1.5, 1.52];
      expect(interpolateNTabulated(200, w, n)).toBe(1.5);
      expect(interpolateNTabulated(900, w, n)).toBe(1.52);
    });
  });

  describe('sellmeierN', () => {
    it('evaluates BK7-like coefficients at 587.6 nm', () => {
      const B = [1.03961212, 0.231792344, 1.01046945];
      const C = [0.00600069867, 0.0200179144, 103.560653];
      const n = sellmeierN(587.6, B, C);
      expect(n).toBeGreaterThan(1.51);
      expect(n).toBeLessThan(1.52);
    });
  });

  describe('materialNAt', () => {
    it('dispatches by kind', () => {
      expect(materialNAt({ kind: 'constant', n: 1.33 }, 500)).toBe(1.33);
      expect(
        materialNAt(
          { kind: 'tabulated', wavelengths: [500], nValues: [1.4] },
          500
        )
      ).toBe(1.4);
      const B = [1.03961212, 0.231792344, 1.01046945];
      const C = [0.00600069867, 0.0200179144, 103.560653];
      expect(
        materialNAt({ kind: 'sellmeier', B, C }, 587.6)
      ).toBeCloseTo(sellmeierN(587.6, B, C), 10);
    });
  });

  describe('nFromMaterialOrCauchy', () => {
    it('uses library when materialId resolves', () => {
      const scene = {
        materialLibrary: {
          water: { kind: 'constant', n: 1.333 }
        }
      };
      expect(nFromMaterialOrCauchy(scene, 'water', 550, 1.5, 0, false)).toBe(
        1.333
      );
    });

    it('falls back to Cauchy when useCauchy is true', () => {
      const scene = { materialLibrary: {} };
      const n = nFromMaterialOrCauchy(scene, '', 500, 1.5, 0.004, true);
      expect(n).toBeCloseTo(1.5 + 0.004 / (500 * 500 * 0.000001), 6);
    });
  });
});
