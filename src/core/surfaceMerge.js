/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

/**
 * Effective refractive index at a location when several homogeneous glasses overlap: pick
 * one representative using stackPriority (higher wins) and scene order as tie-break. This is
 * not a product of indices. {@link BaseGlass.refract} combines two sides (epsilon probes along
 * the ray and/or exiting/entering/persistent classification) as n_incident / n_transmitted.
 *
 * @param {Array<import('./sceneObjs/BaseGlass.js').default>} glasses
 * @param {import('./geometry.js').Point} incidentPoint
 * @param {import('./Simulator.js').Ray} ray
 * @param {import('./Scene.js').default} scene
 * @returns {number}
 */
export function combinedRefIndex(glasses, incidentPoint, ray, scene) {
  if (!glasses || glasses.length === 0) {
    return 1;
  }
  let best = glasses[0];
  let bestIdx = scene.objs.indexOf(best);
  if (bestIdx < 0) {
    bestIdx = 0;
  }
  let bestP = Number(best.stackPriority) || 0;
  for (let i = 1; i < glasses.length; i++) {
    const g = glasses[i];
    const p = Number(g.stackPriority) || 0;
    let idx = scene.objs.indexOf(g);
    if (idx < 0) {
      idx = i;
    }
    if (p > bestP || (p === bestP && idx > bestIdx)) {
      best = g;
      bestIdx = idx;
      bestP = p;
    }
  }
  return best.getRefIndexAt(incidentPoint, ray);
}
