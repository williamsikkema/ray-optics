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

import BaseFilter from '../BaseFilter.js';
import ParamCurveObjMixin from '../ParamCurveObjMixin.js';
import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';
import {
  MirrorSpectralMode,
  migrateMirrorSpectralMode,
  applyMirrorSpectralModeToFlags,
  mirrorSpectralModePropertySchemaEntry,
  populateMirrorSpectralObjBar,
  mirrorTintedStrokeStyle
} from './MirrorSpectralCommon.js';
import { equationValueForListDisplay } from '../../propertyUtils/equationConversion.js';
import escapeHtml from 'escape-html';

/**
 * Mirror with shape defined by parametric curve pieces.
 * 
 * Tools -> Mirror -> Parametric curve
 * @class
 * @extends BaseFilter
 * @memberof sceneObjs
 * @property {Point} origin - The origin point of the parametric coordinate system.
 * @property {Array} pieces - Array of parametric curve pieces, each with eqnX, eqnY, tMin, tMax, tStep.
 * @property {boolean} filter - Whether it is a dichroic mirror.
 * @property {boolean} invert - If true, the ray with wavelength outside the bandwidth is reflected. If false, the ray with wavelength inside the bandwidth is reflected.
 * @property {number} wavelength - The target wavelength if dichroic is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if dichroic is enabled. The unit is nm.
 * @property {Array<Point>} path - The points on the calculated curve.
 */
class ParamMirror extends ParamCurveObjMixin(BaseFilter) {
  static type = 'ParamMirror';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = BaseFilter.mergeFilterSerializable({
    origin: { x: 0, y: 0 },
    pieces: [
      {
        eqnX: "50\\cdot\\cos\\left(t\\right)",
        eqnY: "50\\cdot\\sin\\left(t\\right)",
        tMin: 0,
        tMax: 2 * Math.PI,
        tStep: 0.01
      }
    ],
    mirrorSpectralMode: MirrorSpectralMode.NORMAL,
    filter: false,
    invert: false,
    wavelength: Simulator.GREEN_WAVELENGTH,
    bandwidth: 10
  });

  /**
   * @param {import('../../Scene.js').default} scene
   * @param {Object|null} jsonObj
   */
  constructor(scene, jsonObj) {
    super(scene, jsonObj);
    migrateMirrorSpectralMode(this, jsonObj);
    applyMirrorSpectralModeToFlags(this);
  }

  static getDescription(objData, scene, detailed = false) {
    const base = i18next.t('main:tools.categories.mirror');
    if (!detailed) {
      return i18next.t('main:meta.parentheses', { main: base, sub: i18next.t('main:tools.ParamMirror.title') });
    }
    const pieces = objData?.pieces ?? [];
    const fmt = (v) => escapeHtml(equationValueForListDisplay(v));
    const parts = pieces.map((p) => '(' + fmt(p.eqnX ?? '') + ',' + fmt(p.eqnY ?? '') + ')').filter((c) => c !== '(,)');
    return parts.length ? i18next.t('main:meta.colon', { name: base, value: '<span style="font-family: monospace">' + parts.join(', ') + '</span>' }) : base;
  }

  static getPropertySchema(objData, scene) {
    return [
      ...super.getPropertySchema(objData, scene),
      mirrorSpectralModePropertySchemaEntry()
    ];
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.categories.mirror'));
    objBar.createInfoBox('<ul><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.constants') + '<br><code>pi e</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.operators') + '<br><code>+ - * / ^</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.functions') + '<br><code>sqrt sin cos tan sec csc cot sinh cosh tanh log exp arcsin arccos arctan arcsinh arccosh arctanh floor round ceil trunc sgn max min abs</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.module') + '</li></ul>');
    
    
    // Add parametric curve controls
    this.populateObjBarShape(objBar);
    
    populateMirrorSpectralObjBar(objBar, this);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    // Initialize path if needed
    if (!this.path) {
      if (!this.initPath()) {
        // If initialization failed, draw error indicator at origin
        ctx.fillStyle = "red";
        ctx.fillRect(this.origin.x - 1.5 * ls, this.origin.y - 1.5 * ls, 3 * ls, 3 * ls);
        return;
      }
    }

    // Check if curve is empty or fully degenerate
    let isEmptyOrDegenerate = false;
    
    if (this.path.length < 2) {
      isEmptyOrDegenerate = true;
    } else {
      // Check if all points are identical (fully degenerate curve)
      const firstPoint = this.path[0];
      let allPointsIdentical = true;
      for (let i = 1; i < this.path.length; i++) {
        if (Math.abs(this.path[i].x - firstPoint.x) > 1e-10 || 
            Math.abs(this.path[i].y - firstPoint.y) > 1e-10) {
          allPointsIdentical = false;
          break;
        }
      }
      isEmptyOrDegenerate = allPointsIdentical;
    }

    if (isEmptyOrDegenerate) {
      // Empty or fully degenerate curve - always draw origin square
      ctx.fillStyle = isHovered ? 'rgb(255,0,0)' : 'rgb(128,128,128)';
      ctx.fillRect(this.origin.x - 1.5 * ls, this.origin.y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }

    // Draw the parametric curve
    ctx.strokeStyle = mirrorTintedStrokeStyle(this.scene, this, canvasRenderer, isHovered, this.scene.theme.mirror.color);
    ctx.lineWidth = this.scene.theme.mirror.width * ls;
    
    this.drawPath(canvasRenderer);
    ctx.stroke();
  }

  checkRayIntersects(ray) {
    if (!this.checkRayIntersectFilter(ray)) {
      return null;
    }

    // Get all intersections
    const intersections = this.getRayIntersections(ray);
    
    if (intersections.length === 0) {
      return null;
    }

    // Find the nearest intersection
    let nearestIntersection = null;
    let nearestDistance = Infinity;

    for (const intersection of intersections) {
      // Check for undefined behavior (NaN incidentType)
      if (isNaN(intersection.incidentType)) {
        return {
          isAbsorbed: true,
          isUndefinedBehavior: true
        };
      }

      const distance = geometry.distanceSquared(ray.p1, intersection.s_point);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIntersection = intersection;
      }
    }

    return nearestIntersection ? nearestIntersection.s_point : null;
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    // Get all intersections to find the one at the incident point
    const intersections = this.getRayIntersections(ray);
    
    // Find the intersection that matches the incident point
    let matchingIntersection = null;
    for (const intersection of intersections) {
      if (geometry.distanceSquared(incidentPoint, intersection.s_point) < 1e-10) {
        matchingIntersection = intersection;
        break;
      }
    }

    if (!matchingIntersection) {
      // Fallback - shouldn't happen if checkRayIntersects worked correctly
      return;
    }

    // Check for undefined behavior
    if (isNaN(matchingIntersection.incidentType) || 
        isNaN(matchingIntersection.normal.x) || 
        isNaN(matchingIntersection.normal.y)) {
      // Absorb the ray for undefined behavior
      return;
    }

    const nx0 = matchingIntersection.normal.x;
    const ny0 = matchingIntersection.normal.y;
    const normalLength = Math.sqrt(nx0 * nx0 + ny0 * ny0);
    if (normalLength < 1e-10) {
      return;
    }
    const nnx = nx0 / normalLength;
    const nny = ny0 / normalLength;

    const applyParamReflection = (r) => {
      const rx = r.p2.x - r.p1.x;
      const ry = r.p2.y - r.p1.y;
      const dotProduct = rx * nnx + ry * nny;
      const reflectedX = rx - 2 * dotProduct * nnx;
      const reflectedY = ry - 2 * dotProduct * nny;
      r.p1 = incidentPoint;
      r.p2 = geometry.point(incidentPoint.x + reflectedX, incidentPoint.y + reflectedY);
    };

    const spectral = this.trySpectralReflectanceSplit(ray, incidentPoint, applyParamReflection);
    if (spectral) {
      return spectral;
    }
    applyParamReflection(ray);
  }
}

export default ParamMirror; 