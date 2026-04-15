/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

export const SPECTRAL_PLOT_EVENT = 'rayoptics-openSpectralPlot';

/**
 * Ask the UI to open the spectral plot modal for a scene object (dispatched on document).
 * @param {import('./Scene.js').default} scene
 * @param {*} obj
 */
export function dispatchOpenSpectralPlot(scene, obj) {
  document.dispatchEvent(
    new CustomEvent(SPECTRAL_PLOT_EVENT, {
      detail: { scene, obj }
    })
  );
}
