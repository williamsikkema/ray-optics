/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import BaseSceneObj from './BaseSceneObj.js';
import Simulator from '../Simulator.js';
import geometry from '../geometry.js';
import i18next from 'i18next';
import { sampleCurve } from '../curveSamples.js';
import { dichroicLinearEdgeReflectance } from '../spectral.js';
import { hasSpectralPlotContent } from '../spectralPlotSampler.js';
import { dispatchOpenSpectralPlot } from '../spectralPlotEvents.js';

/**
 * The base class for optical elements with wavelength filter functionality, including mirrors and blockers.
 * Mirrors may use a simple rectangular band (center ± bandwidth) and/or tabular R(λ) / k(λ) for full spectral response.
 * @class
 * @extends BaseSceneObj
 * @property {boolean} filter - Whether the filter feature is enabled.
 * @property {boolean} invert - If true, the element interacts with the ray only if its wavelength is outside the bandwidth of the filter. If false, the element interacts with the ray only if its wavelength is within the bandwidth of the filter.
 * @property {number} wavelength - The target wavelength of the filter. The unit is nm.
 * @property {number} bandwidth - The bandwidth of the filter. The unit is nm.
 */
class BaseFilter extends BaseSceneObj {

  /**
   * @param {Object} extra
   * @returns {Object}
   */
  static mergeFilterSerializable(extra) {
    return {
      spectralExtinction: false,
      extinctionWavelengths: [],
      extinctionK: [],
      filterThicknessMm: 1,
      spectralReflectance: false,
      reflectanceWavelengths: [],
      reflectanceValues: [],
      ...extra
    };
  }

  static getPropertySchema(objData, scene) {
    return [
      { key: 'filter', type: 'boolean', label: i18next.t('simulator:sceneObjs.BaseFilter.filter') },
      { key: 'invert', type: 'boolean', label: i18next.t('simulator:sceneObjs.BaseFilter.invert') },
      { key: 'wavelength', type: 'number', label: i18next.t('simulator:sceneObjs.common.wavelength') + ' (nm)' },
      { key: 'bandwidth', type: 'number', label: i18next.t('simulator:sceneObjs.BaseFilter.bandwidth') + ' (nm)' },
    ];
  }

  populateObjBar(objBar) {
    if (this.scene.simulateColors) {
      const labelKeys =
        typeof this.constructor.getFilterObjBarLabels === 'function'
          ? this.constructor.getFilterObjBarLabels()
          : null;
      const filterLabel = labelKeys?.filter
        ? i18next.t(labelKeys.filter)
        : i18next.t('simulator:sceneObjs.BaseFilter.filter');
      const invertLabel = labelKeys?.invert
        ? i18next.t(labelKeys.invert)
        : i18next.t('simulator:sceneObjs.BaseFilter.invert');
      objBar.createBoolean(filterLabel, this.filter, function (obj, value) {
        obj.filter = value;
        obj.wavelength = obj.wavelength;
        obj.invert = obj.invert;
        obj.bandwidth = obj.bandwidth;
      }, null, true);
      if (this.filter) {
        objBar.createBoolean(invertLabel, this.invert, function (obj, value) {
          if (obj.filter) {
            obj.invert = value;
          }
        });
        objBar.createNumber(i18next.t('simulator:sceneObjs.common.wavelength') + ' (nm)', Simulator.UV_WAVELENGTH, Simulator.INFRARED_WAVELENGTH, 1, this.wavelength, function (obj, value) {
          obj.wavelength = value;
        });
        objBar.createNumber("± " + i18next.t('simulator:sceneObjs.BaseFilter.bandwidth') + ' (nm)', 0, (Simulator.INFRARED_WAVELENGTH - Simulator.UV_WAVELENGTH), 1, this.bandwidth, function (obj, value) {
          obj.bandwidth = value;
        });
      }

      if (hasSpectralPlotContent(this.scene, this)) {
        objBar.createButton(
          'Spectral plot…',
          function (obj) {
            dispatchOpenSpectralPlot(obj.scene, obj);
          },
          false,
          null
        );
      }
    }
  }

  /**
   * Checks if the ray interacts with the filter at the level of the wavelength.
   * @param {Ray} ray - The ray to be checked.
   * @returns {boolean} - If true, the ray interacts with the filter at the level of the wavelength.
   */
  checkRayIntersectFilter(ray) {
    if (!this.scene.simulateColors) {
      return true;
    }
    // Tabular k(λ) or R(λ): wavelength interaction is handled in trySpectral*; all rays still "hit" the surface.
    if (this.spectralExtinction && this.extinctionWavelengths?.length >= 2) {
      return true;
    }
    if (this.spectralReflectance && this.reflectanceWavelengths?.length >= 2) {
      return true;
    }
    if (this.spectralReflectance && this.mirrorSpectralMode === 'dichroic' && !(this.reflectanceWavelengths?.length >= 2)) {
      return true;
    }
    if (!this.filter) {
      return true;
    }
    var dichroicEnabled = this.wavelength;
    var rayHueMatchesMirror = Math.abs(this.wavelength - ray.wavelength) <= this.bandwidth;
    return !dichroicEnabled || (rayHueMatchesMirror != this.invert);
  }

  /**
   * Tabular R(λ) or dichroic linear-edge R(λ). Returns null when this interaction is not spectral-partial.
   * @param {import('./Ray.js').Ray} ray
   * @returns {number|null}
   */
  getSpectralReflectanceR(ray) {
    if (!this.scene.simulateColors || !this.spectralReflectance) {
      return null;
    }
    const lam = ray.wavelength || Simulator.GREEN_WAVELENGTH;
    if (this.reflectanceWavelengths && this.reflectanceWavelengths.length >= 2) {
      let R = sampleCurve(lam, this.reflectanceWavelengths, this.reflectanceValues, 0);
      R = Math.max(0, Math.min(1, R));
      if (this.invert) {
        R = 1 - R;
      }
      return R;
    }
    if (this.mirrorSpectralMode === 'dichroic') {
      return dichroicLinearEdgeReflectance(lam, this.wavelength, this.bandwidth, this.invert);
    }
    return null;
  }

  /**
   * Partial spectral reflectance: `applyReflection` performs the mirror’s true reflection; brightness is scaled by R(λ)
   * and a companion ray with (1−R) is emitted along the incident direction.
   * @param {import('./Ray.js').Ray} ray
   * @param {*} incidentPoint
   * @param {function(import('./Ray.js').Ray): void} applyReflection
   * @returns {object|null}
   */
  trySpectralReflectanceSplit(ray, incidentPoint, applyReflection) {
    const R = this.getSpectralReflectanceR(ray);
    if (R == null) {
      return null;
    }
    const T = 1 - R;
    const bs0 = ray.brightness_s;
    const bp0 = ray.brightness_p;
    const inx = incidentPoint.x - ray.p1.x;
    const iny = incidentPoint.y - ray.p1.y;
    const inlen = Math.hypot(inx, iny) || 1;
    const ux = inx / inlen;
    const uy = iny / inlen;
    const eps = Simulator.MIN_RAY_SEGMENT_LENGTH * this.scene.lengthScale * 10;

    applyReflection(ray);

    ray.brightness_s = bs0 * R;
    ray.brightness_p = bp0 * R;

    if (T <= 1e-9) {
      return {};
    }
    const tRay = geometry.line(
      geometry.point(incidentPoint.x + ux * eps, incidentPoint.y + uy * eps),
      geometry.point(incidentPoint.x + ux * (eps + 1), incidentPoint.y + uy * (eps + 1))
    );
    tRay.brightness_s = bs0 * T;
    tRay.brightness_p = bp0 * T;
    tRay.wavelength = ray.wavelength;
    tRay.gap = ray.gap;
    tRay.isNew = ray.isNew;
    if (ray.depth != null) {
      tRay.depth = ray.depth;
    }
    return { newRays: [tRay] };
  }

  /**
   * Line mirror: partial spectral reflectance R(λ), transmit (1−R) along the incident direction.
   * @returns {object|null}
   */
  trySpectralLineMirror(ray, incidentPoint, p1, p2) {
    return this.trySpectralReflectanceSplit(ray, incidentPoint, (r) => {
      const rx = r.p1.x - incidentPoint.x;
      const ry = r.p1.y - incidentPoint.y;
      const mx = p2.x - p1.x;
      const my = p2.y - p1.y;
      r.p1 = incidentPoint;
      r.p2 = geometry.point(incidentPoint.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, incidentPoint.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
    });
  }

  /**
   * Thin absorbing filter: Beer–Lambert attenuation along incidence, ray continues.
   * @returns {boolean} true if handled
   */
  trySpectralExtinctionPass(ray, incidentPoint) {
    if (!this.scene.simulateColors || !this.spectralExtinction || !this.extinctionWavelengths || this.extinctionWavelengths.length < 2) {
      return false;
    }
    const lam = ray.wavelength || Simulator.GREEN_WAVELENGTH;
    const k = Math.max(0, sampleCurve(lam, this.extinctionWavelengths, this.extinctionK, 0));
    const d = Math.max(0, this.filterThicknessMm || 1);
    const att = Math.exp(-k * d);
    const inx = incidentPoint.x - ray.p1.x;
    const iny = incidentPoint.y - ray.p1.y;
    const inlen = Math.hypot(inx, iny) || 1;
    const ux = inx / inlen;
    const uy = iny / inlen;
    const eps = Simulator.MIN_RAY_SEGMENT_LENGTH * this.scene.lengthScale * 10;
    ray.brightness_s *= att;
    ray.brightness_p *= att;
    ray.p1 = geometry.point(incidentPoint.x + ux * eps, incidentPoint.y + uy * eps);
    ray.p2 = geometry.point(incidentPoint.x + ux * (eps + 1), incidentPoint.y + uy * (eps + 1));
    return true;
  }
};

export default BaseFilter;