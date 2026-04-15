/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
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
import LineObjMixin from '../LineObjMixin.js';
import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';
import {
  MirrorSpectralMode,
  migrateMirrorSpectralMode,
  applyMirrorSpectralModeToFlags as syncMirrorSpectralFlagsFromMode,
  mirrorSpectralModePropertySchemaEntry,
  populateMirrorSpectralObjBar,
  mirrorTintedStrokeStyle
} from './MirrorSpectralCommon.js';

/**
 * Mirror with shape of a line segment.
 *
 * Tools -> Mirror -> Segment
 * @class
 * @extends BaseFilter
 * @memberof sceneObjs
 * @property {string} mirrorSpectralMode - `normal` | `filter` | `dichroic`. Mutually exclusive; drives `filter` and `spectralReflectance`.
 * @property {boolean} filter - True when mode is `filter` (rectangular band).
 * @property {boolean} spectralReflectance - True when mode is `dichroic` (edge R(λ) from center ± bandwidth, or tabular JSON if provided).
 * @property {boolean} invert - Filter: band-pass vs band-stop. Dichroic: swaps the short-λ and long-λ sides of the linear edge (same idea as filter invert).
 */
class Mirror extends LineObjMixin(BaseFilter) {
  static type = 'Mirror';
  static isOptical = true;
  static mergesWithGlass = true;

  static serializableDefaults = BaseFilter.mergeFilterSerializable({
    p1: null,
    p2: null,
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
    syncMirrorSpectralFlagsFromMode(this);
  }

  /**
   * Keep `filter` / `spectralReflectance` consistent with `mirrorSpectralMode`.
   */
  applyMirrorSpectralModeToFlags() {
    syncMirrorSpectralFlagsFromMode(this);
  }

  /**
   * @param {string} mode - {@link MirrorSpectralMode}
   */
  setMirrorSpectralMode(mode) {
    this.mirrorSpectralMode = mode;
    syncMirrorSpectralFlagsFromMode(this);
  }

  static getDescription(objData, scene, detailed = false) {
    return i18next.t('main:meta.parentheses', { main: i18next.t('main:tools.categories.mirror'), sub: i18next.t('main:tools.Mirror.title') });
  }

  static getPropertySchema(objData, scene) {
    return [
      ...super.getPropertySchema(objData, scene),
      mirrorSpectralModePropertySchemaEntry()
    ];
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:meta.parentheses', { main: i18next.t('main:tools.categories.mirror'), sub: i18next.t('main:tools.Mirror.title') }));
    populateMirrorSpectralObjBar(objBar, this);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      ctx.fillStyle = 'rgb(128,128,128)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }

    ctx.strokeStyle = mirrorTintedStrokeStyle(this.scene, this, canvasRenderer, isHovered, this.scene.theme.mirror.color);
    ctx.lineWidth = this.scene.theme.mirror.width * ls;
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
  }

  checkRayIntersects(ray) {
    if (this.checkRayIntersectFilter(ray)) {
      return this.checkRayIntersectsShape(ray);
    } else {
      return null;
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    const spectral = this.trySpectralLineMirror(ray, incidentPoint, this.p1, this.p2);
    if (spectral) {
      return spectral;
    }
    var rx = ray.p1.x - incidentPoint.x;
    var ry = ray.p1.y - incidentPoint.y;
    var mx = this.p2.x - this.p1.x;
    var my = this.p2.y - this.p1.y;

    ray.p1 = incidentPoint;
    ray.p2 = geometry.point(incidentPoint.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, incidentPoint.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
  }
}

export default Mirror;
