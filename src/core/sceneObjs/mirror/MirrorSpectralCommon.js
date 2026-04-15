/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import { hasSpectralPlotContent } from '../../spectralPlotSampler.js';
import { dispatchOpenSpectralPlot } from '../../spectralPlotEvents.js';

/** @enum {string} */
export const MirrorSpectralMode = {
  NORMAL: 'normal',
  FILTER: 'filter',
  DICHROIC: 'dichroic'
};

/**
 * @param {*} obj
 * @param {Object|null} jsonObj
 */
export function migrateMirrorSpectralMode(obj, jsonObj) {
  if (jsonObj && !Object.prototype.hasOwnProperty.call(jsonObj, 'mirrorSpectralMode')) {
    if (obj.spectralReflectance && obj.reflectanceWavelengths?.length >= 2) {
      obj.mirrorSpectralMode = MirrorSpectralMode.DICHROIC;
    } else if (obj.filter) {
      obj.mirrorSpectralMode = MirrorSpectralMode.FILTER;
    } else {
      obj.mirrorSpectralMode = MirrorSpectralMode.NORMAL;
    }
  }
}

/**
 * Keep `filter` / `spectralReflectance` consistent with `mirrorSpectralMode`.
 * @param {*} obj
 */
export function applyMirrorSpectralModeToFlags(obj) {
  if (obj.mirrorSpectralMode === MirrorSpectralMode.NORMAL) {
    obj.filter = false;
    obj.spectralReflectance = false;
  } else if (obj.mirrorSpectralMode === MirrorSpectralMode.FILTER) {
    obj.filter = true;
    obj.spectralReflectance = false;
  } else if (obj.mirrorSpectralMode === MirrorSpectralMode.DICHROIC) {
    obj.filter = false;
    obj.spectralReflectance = true;
  }
}

/**
 * Property-schema entry for the mirror spectral mode dropdown.
 */
export function mirrorSpectralModePropertySchemaEntry() {
  return {
    key: 'mirrorSpectralMode',
    type: 'dropdown',
    label: i18next.t('simulator:sceneObjs.Mirror.spectralMode'),
    options: {
      [MirrorSpectralMode.NORMAL]: i18next.t('simulator:sceneObjs.Mirror.modeNormal'),
      [MirrorSpectralMode.FILTER]: i18next.t('simulator:sceneObjs.Mirror.modeFilter'),
      [MirrorSpectralMode.DICHROIC]: i18next.t('simulator:sceneObjs.Mirror.modeDichroic')
    }
  };
}

/**
 * Object bar block for mirror spectral modes (Normal / Filter / Dichroic).
 * Call after `setTitle` and tool-specific controls; only when `scene.simulateColors`.
 * @param {*} objBar
 * @param {*} obj
 */
export function populateMirrorSpectralObjBar(objBar, obj) {
  if (!obj.scene.simulateColors) {
    return;
  }

  const modeOptions = {
    [MirrorSpectralMode.NORMAL]: i18next.t('simulator:sceneObjs.Mirror.modeNormal'),
    [MirrorSpectralMode.FILTER]: i18next.t('simulator:sceneObjs.Mirror.modeFilter'),
    [MirrorSpectralMode.DICHROIC]: i18next.t('simulator:sceneObjs.Mirror.modeDichroic')
  };

  objBar.createDropdown(
    i18next.t('simulator:sceneObjs.Mirror.spectralMode'),
    obj.mirrorSpectralMode,
    modeOptions,
    (o, value) => {
      o.mirrorSpectralMode = value;
      applyMirrorSpectralModeToFlags(o);
    },
    i18next.t('simulator:sceneObjs.Mirror.spectralModeInfo'),
    true
  );

  if (obj.mirrorSpectralMode === MirrorSpectralMode.FILTER || obj.mirrorSpectralMode === MirrorSpectralMode.DICHROIC) {
    objBar.createBoolean(
      i18next.t('simulator:sceneObjs.Mirror.invert'),
      obj.invert,
      function (o, value) {
        o.invert = value;
      },
      i18next.t('simulator:sceneObjs.Mirror.invertInfo'),
      true
    );
  }

  if (obj.mirrorSpectralMode === MirrorSpectralMode.FILTER || obj.mirrorSpectralMode === MirrorSpectralMode.DICHROIC) {
    objBar.createNumber(
      i18next.t('simulator:sceneObjs.common.wavelength') + ' (nm)',
      Simulator.UV_WAVELENGTH,
      Simulator.INFRARED_WAVELENGTH,
      1,
      obj.wavelength,
      function (o, value) {
        o.wavelength = value;
      }
    );
    objBar.createNumber(
      '± ' + i18next.t('simulator:sceneObjs.BaseFilter.bandwidth') + ' (nm)',
      0,
      Simulator.INFRARED_WAVELENGTH - Simulator.UV_WAVELENGTH,
      1,
      obj.bandwidth,
      function (o, value) {
        o.bandwidth = value;
      }
    );
  }

  if (hasSpectralPlotContent(obj.scene, obj)) {
    objBar.createButton(
      'Spectral plot…',
      function (o) {
        dispatchOpenSpectralPlot(o.scene, o);
      },
      false,
      null
    );
  }
}

/**
 * Stroke color for mirrors with filter or dichroic spectral tinting.
 * @param {*} scene
 * @param {*} obj
 * @param {*} canvasRenderer
 * @param {boolean} isHovered
 * @param {string|{r:number,g:number,b:number,a?:number}} defaultColor
 * @returns {string}
 */
export function mirrorTintedStrokeStyle(scene, obj, canvasRenderer, isHovered, defaultColor) {
  const colorArray = scene.simulator.wavelengthToColor(obj.wavelength || Simulator.GREEN_WAVELENGTH, 1);
  const colorByMode = obj.mirrorSpectralMode === MirrorSpectralMode.FILTER && obj.wavelength && obj.filter;
  const colorDichroic = obj.mirrorSpectralMode === MirrorSpectralMode.DICHROIC && obj.spectralReflectance;
  return isHovered
    ? scene.highlightColorCss
    : canvasRenderer.rgbaToCssColor(
        scene.simulateColors && (colorByMode || colorDichroic) ? colorArray : defaultColor
      );
}
