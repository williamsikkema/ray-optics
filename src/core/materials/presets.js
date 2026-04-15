/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

/**
 * Literature-based preset materials (dispersion). Wavelengths in nm for tabulated;
 * Sellmeier uses standard formula with λ in µm.
 *
 * BK7: Schott glass datasheet (Sellmeier-2).
 * Diamond: Malitson / Perkins (common Sellmeier form).
 * Cubic zirconia: approximate dispersion (Sellmeier-style fit, illustrative).
 * Water: Malitson 1963 (tabulated sample points).
 * Salt water: 35 PSU approx (tabulated, illustrative vs fresh water).
 * Air: Ciddor 1996 approximate (constant deviation from 1).
 */

/** @type {Object<string, import('./evaluateMaterial.js').MaterialDefinition>} */
export const MATERIAL_PRESETS = {
  air: {
    kind: 'constant',
    n: 1.000273,
  },
  bk7_glass: {
    kind: 'sellmeier',
    B: [1.03961212, 0.231792344, 1.01046945],
    C: [0.00600069867, 0.0200179144, 103.560653],
  },
  diamond: {
    kind: 'tabulated',
    wavelengths: [380, 420, 460, 500, 540, 580, 620, 660, 700],
    nValues: [2.458, 2.441, 2.425, 2.417, 2.411, 2.407, 2.404, 2.402, 2.400],
  },
  cubic_zirconia: {
    kind: 'tabulated',
    wavelengths: [380, 420, 460, 500, 540, 580, 620, 660, 700],
    nValues: [2.230, 2.221, 2.214, 2.208, 2.204, 2.200, 2.197, 2.194, 2.192],
  },
  fresh_water: {
    kind: 'tabulated',
    wavelengths: [380, 400, 420, 440, 460, 480, 500, 520, 540, 560, 580, 600, 620, 640, 660, 680, 700],
    nValues: [1.3435, 1.3428, 1.3422, 1.3417, 1.3412, 1.3407, 1.3403, 1.3399, 1.3395, 1.3392, 1.3388, 1.3385, 1.3382, 1.3379, 1.3376, 1.3373, 1.3371],
  },
  salt_water: {
    kind: 'tabulated',
    wavelengths: [380, 400, 420, 440, 460, 480, 500, 520, 540, 560, 580, 600, 620, 640, 660, 680, 700],
    nValues: [1.3495, 1.3487, 1.3480, 1.3474, 1.3468, 1.3463, 1.3458, 1.3453, 1.3449, 1.3445, 1.3441, 1.3437, 1.3433, 1.3430, 1.3426, 1.3423, 1.3420],
  },
};

export function ensurePresetMaterials(scene) {
  if (!scene.materialLibrary) {
    scene.materialLibrary = {};
  }
  for (const id of Object.keys(MATERIAL_PRESETS)) {
    if (scene.materialLibrary[id] === undefined) {
      scene.materialLibrary[id] = JSON.parse(JSON.stringify(MATERIAL_PRESETS[id]));
    }
  }
}
