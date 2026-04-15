/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import Simulator from './Simulator.js';
import i18next from 'i18next';
import { hasSpectralPlotContent } from './spectralPlotSampler.js';
import { dispatchOpenSpectralPlot } from './spectralPlotEvents.js';

const SPECTRUM_CHOICES = {
  mono: 'Single wavelength',
  uniform: 'White',
  tabular: 'Piecewise-linear SPD',
  led: 'LED (Gaussian)',
  fluorescent: 'Fluorescent tube',
  sodium_vapor: 'Sodium vapor',
  mercury_vapor: 'Mercury vapor',
  xenon_arc: 'Xenon short-arc',
  blackbody: 'Blackbody'
};

const BLACKBODY_PRESET_LABELS = {
  custom: 'Custom (set T below)',
  sun: 'Sun (~5778 K)',
  d65: 'CIE D65 (~6504 K)',
  tungsten: 'Incandescent tungsten (~2700 K)',
  halogen: 'Halogen (~3200 K)',
  candle: 'Candle (~2000 K)'
};

const BLACKBODY_PRESET_TEMPS = {
  sun: 5778,
  d65: 6504,
  tungsten: 2700,
  halogen: 3200,
  candle: 2000
};

const FLUORESCENT_LABELS = {
  cool_white: 'Cool white',
  warm_white: 'Warm white',
  daylight: 'Daylight',
  tri_phosphor: 'Tri-phosphor'
};

const SODIUM_LABELS = {
  lps: 'Low-pressure (Na D-lines)',
  hps: 'High-pressure (broad yellow)'
};

/**
 * Spectrum dropdown + mode-specific sliders for light sources when "Simulate Colors" is on.
 * @param {*} objBar
 * @param {{ scene: import('./Scene.js').default, spectralMode?: string, wavelength?: number, spectralWavelengths?: number[], spectralPower?: number[], blackbodyTempK?: number, blackbodyPreset?: string, ledPeakNm?: number, ledFwhmNm?: number, fluorescentPreset?: string, sodiumPreset?: string }} obj
 * @param {{ helpHtml?: string }} [options]
 */
export function populateSpectralSourceSpectrumUi(objBar, obj, options = {}) {
  if (!obj.scene.simulateColors) {
    return;
  }
  const help = options.helpHtml
    ? options.helpHtml
    : '<p>Broadband sources are split into rays by wavelength; bin width (nm) is set next to ray density in the toolbar.</p>';

  objBar.createDropdown(
    'Spectrum',
    obj.spectralMode || 'mono',
    SPECTRUM_CHOICES,
    (o, value) => {
      o.spectralMode = value;
    },
    help
  );

  const mode = obj.spectralMode || 'mono';

  if (mode === 'mono') {
    objBar.createNumber(
      i18next.t('simulator:sceneObjs.common.wavelength') + ' (nm)',
      Simulator.UV_WAVELENGTH,
      Simulator.INFRARED_WAVELENGTH,
      1,
      obj.wavelength,
      (o, value) => {
        o.wavelength = value;
      }
    );
  }

  if (mode === 'blackbody') {
    objBar.createDropdown(
      'Blackbody preset',
      obj.blackbodyPreset || 'custom',
      BLACKBODY_PRESET_LABELS,
      (o, value) => {
        o.blackbodyPreset = value;
        const t = BLACKBODY_PRESET_TEMPS[value];
        if (t != null) {
          o.blackbodyTempK = t;
        }
      },
      '<p>Pick a typical illuminant or choose Custom and set temperature.</p>'
    );
    objBar.createNumber(
      'Blackbody T (K)',
      500,
      20000,
      50,
      obj.blackbodyTempK,
      (o, value) => {
        o.blackbodyTempK = value;
        o.blackbodyPreset = 'custom';
      }
    );
  }

  if (mode === 'led') {
    objBar.createNumber(
      'LED peak λ (nm)',
      Simulator.UV_WAVELENGTH,
      Simulator.INFRARED_WAVELENGTH,
      1,
      obj.ledPeakNm,
      (o, value) => {
        o.ledPeakNm = value;
      }
    );
    objBar.createNumber(
      'LED FWHM (nm)',
      5,
      150,
      1,
      obj.ledFwhmNm,
      (o, value) => {
        o.ledFwhmNm = value;
      },
      '<p>Full width at half maximum of a Gaussian spectrum.</p>'
    );
  }

  if (mode === 'fluorescent') {
    objBar.createDropdown(
      'Tube type',
      obj.fluorescentPreset || 'cool_white',
      FLUORESCENT_LABELS,
      (o, value) => {
        o.fluorescentPreset = value;
      },
      '<p>Illustrative multi-band phosphor shapes, not CIE-matched.</p>'
    );
  }

  if (mode === 'sodium_vapor') {
    objBar.createDropdown(
      'Lamp type',
      obj.sodiumPreset || 'lps',
      SODIUM_LABELS,
      (o, value) => {
        o.sodiumPreset = value;
      }
    );
  }

  if (hasSpectralPlotContent(obj.scene, obj)) {
    objBar.createButton(
      'Spectral plot…',
      (o) => {
        dispatchOpenSpectralPlot(o.scene, o);
      },
      false,
      null
    );
  }
}
