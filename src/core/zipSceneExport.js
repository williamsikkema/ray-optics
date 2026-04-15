/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 */

import JSZip from 'jszip';

function safeFileId(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * @param {import('./Scene.js').default} scene
 * @returns {Promise<Blob>}
 */
export async function exportSceneToZipBlob(scene) {
  const zip = new JSZip();
  const geo = JSON.parse(scene.toJSON());
  const matLib = geo.materialLibrary || {};

  for (const id of Object.keys(matLib)) {
    const def = matLib[id];
    zip.file(`materials/${safeFileId(id)}.json`, JSON.stringify({ id, definition: def }, null, 2));
  }
  geo.materialLibrary = {};
  for (const id of Object.keys(matLib)) {
    geo.materialLibrary[id] = `materials/${safeFileId(id)}.json`;
  }

  let li = 0;
  let fi = 0;
  let di = 0;
  if (geo.objs) {
    for (let i = 0; i < geo.objs.length; i++) {
      const o = geo.objs[i];
      const t = o.type;
      if (['PointSource', 'AngleSource', 'Beam', 'SingleRay'].includes(t) && o.spectralMode === 'tabular' && o.spectralWavelengths?.length) {
        const name = `light_${li++}`;
        zip.file(`lightSources/${name}.json`, JSON.stringify({
          type: t,
          spectralWavelengths: o.spectralWavelengths,
          spectralPower: o.spectralPower || []
        }, null, 2));
        o.spectralTableFile = `lightSources/${name}.json`;
        delete o.spectralWavelengths;
        delete o.spectralPower;
      }
      if (o.spectralExtinction && o.extinctionWavelengths?.length >= 2) {
        const name = `filter_${fi++}`;
        zip.file(`filters/${name}.json`, JSON.stringify({
          type: o.type,
          extinctionWavelengths: o.extinctionWavelengths,
          extinctionK: o.extinctionK || [],
          filterThicknessMm: o.filterThicknessMm
        }, null, 2));
        o.extinctionTableFile = `filters/${name}.json`;
        delete o.extinctionWavelengths;
        delete o.extinctionK;
      }
      if (o.spectralReflectance && o.reflectanceWavelengths?.length >= 2) {
        const name = `dichroic_${di++}`;
        zip.file(`dichroicMirrors/${name}.json`, JSON.stringify({
          type: o.type,
          reflectanceWavelengths: o.reflectanceWavelengths,
          reflectanceValues: o.reflectanceValues || []
        }, null, 2));
        o.dichroicTableFile = `dichroicMirrors/${name}.json`;
        delete o.reflectanceWavelengths;
        delete o.reflectanceValues;
      }
    }
  }

  zip.file('geometry.json', JSON.stringify(geo, null, 2));
  return zip.generateAsync({ type: 'blob' });
}

/**
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<string>} JSON string for Scene.loadJSON
 */
export async function importSceneFromZip(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const geomEntry = zip.file('geometry.json');
  if (!geomEntry) {
    throw new Error('geometry.json not found in archive');
  }
  const geo = JSON.parse(await geomEntry.async('string'));
  const matPaths = geo.materialLibrary || {};
  const matLib = {};
  for (const id of Object.keys(matPaths)) {
    const p = matPaths[id];
    if (typeof p === 'string') {
      const f = zip.file(p);
      if (f) {
        const data = JSON.parse(await f.async('string'));
        matLib[id] = data.definition ?? data;
      }
    } else if (p && typeof p === 'object') {
      matLib[id] = p;
    }
  }
  geo.materialLibrary = matLib;

  if (geo.objs) {
    for (const o of geo.objs) {
      if (o.spectralTableFile) {
        const f = zip.file(o.spectralTableFile);
        if (f) {
          const data = JSON.parse(await f.async('string'));
          o.spectralWavelengths = data.spectralWavelengths;
          o.spectralPower = data.spectralPower;
        }
        delete o.spectralTableFile;
      }
      if (o.extinctionTableFile) {
        const f = zip.file(o.extinctionTableFile);
        if (f) {
          const data = JSON.parse(await f.async('string'));
          o.extinctionWavelengths = data.extinctionWavelengths;
          o.extinctionK = data.extinctionK;
          if (data.filterThicknessMm != null) {
            o.filterThicknessMm = data.filterThicknessMm;
          }
        }
        delete o.extinctionTableFile;
      }
      if (o.dichroicTableFile) {
        const f = zip.file(o.dichroicTableFile);
        if (f) {
          const data = JSON.parse(await f.async('string'));
          o.reflectanceWavelengths = data.reflectanceWavelengths;
          o.reflectanceValues = data.reflectanceValues;
        }
        delete o.dichroicTableFile;
      }
    }
  }

  return JSON.stringify(geo);
}
