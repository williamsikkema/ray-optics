/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {
  exportSceneToZipBlob,
  importSceneFromZip
} from '../../src/core/zipSceneExport.js';

function sceneFromGeo(geo) {
  return {
    toJSON() {
      return JSON.stringify(geo, null, 2);
    }
  };
}

describe('zipSceneExport', () => {
  it('round-trips materials and tabular spectral table via zip', async () => {
    const geo = {
      version: 6,
      width: 1000,
      height: 600,
      materialLibrary: {
        test_mat: { kind: 'constant', n: 1.52 }
      },
      objs: [
        {
          type: 'PointSource',
          spectralMode: 'tabular',
          spectralWavelengths: [400, 700],
          spectralPower: [1, 2],
          x: 100,
          y: 100
        }
      ]
    };

    const blob = await exportSceneToZipBlob(sceneFromGeo(geo));
    const ab = await blob.arrayBuffer();
    const jsonStr = await importSceneFromZip(ab);
    const back = JSON.parse(jsonStr);

    expect(back.materialLibrary.test_mat).toEqual(geo.materialLibrary.test_mat);
    const src = back.objs[0];
    expect(src.spectralWavelengths).toEqual([400, 700]);
    expect(src.spectralPower).toEqual([1, 2]);
    expect(src.spectralTableFile).toBeUndefined();
  });
});
