/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import Scene from '../../src/core/Scene.js';
import PointSource from '../../src/core/sceneObjs/lightSource/PointSource.js';
import { buildSpectralPlotData, hasSpectralPlotContent } from '../../src/core/spectralPlotSampler.js';

describe('spectralPlotSampler', () => {
  it('builds emission plot for a light source', () => {
    const scene = new Scene();
    scene.simulateColors = true;
    scene.spectralResolutionNm = 10;
    const src = new PointSource(scene);
    src.spectralMode = 'led';
    src.ledPeakNm = 520;
    src.ledFwhmNm = 40;
    const data = buildSpectralPlotData(scene, src);
    expect(data).not.toBeNull();
    expect(data.panels.length).toBe(1);
    expect(data.panels[0].series[0].points.length).toBeGreaterThan(10);
    expect(hasSpectralPlotContent(scene, src)).toBe(true);
  });

  it('returns null when colors are off', () => {
    const scene = new Scene();
    scene.simulateColors = false;
    const src = new PointSource(scene);
    expect(buildSpectralPlotData(scene, src)).toBeNull();
    expect(hasSpectralPlotContent(scene, src)).toBe(false);
  });
});
