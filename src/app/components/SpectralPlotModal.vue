<!--
  Copyright 2026 The Ray Optics Simulation authors and contributors

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
-->

<template>
  <!-- Manual open/close: no Bootstrap Modal JS. Teleport to body avoids flex/stacking quirks; pointer-events fixes BS5 .modal { pointer-events: none } on backdrop. -->
  <Teleport to="body">
    <div
      class="modal fade spectral-plot-modal-root"
      id="spectralPlotModal"
      data-bs-backdrop="false"
      data-bs-keyboard="false"
      tabindex="-1"
      aria-labelledby="spectralPlotModalTitle"
      aria-hidden="true"
    >
      <div class="modal-backdrop fade" :class="{ show: isOpen }" @click="closeModal"></div>
      <div class="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered" @click.stop>
        <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="spectralPlotModalTitle">{{ headerTitle }}</h5>
          <button type="button" class="btn-close" aria-label="Close" @click="closeModal"></button>
        </div>
        <div class="modal-body" ref="bodyEl">
          <p v-if="headerSubtitle" class="text-muted small mb-3">{{ headerSubtitle }}</p>
          <p v-if="emptyMessage" class="alert alert-warning">{{ emptyMessage }}</p>
          <template v-if="panels.length">
            <div v-for="(panel, pi) in panels" :key="pi" class="mb-4 spectral-plot-panel">
              <div class="fw-semibold mb-1">{{ panel.title }}</div>
              <div class="text-muted small mb-1">{{ panel.yLabel }}</div>
              <canvas
                class="spectral-plot-canvas w-100 border rounded bg-white"
                :data-panel-index="pi"
                height="220"
              ></canvas>
              <div class="small mt-1 d-flex flex-wrap gap-3">
                <span v-for="(s, si) in panel.series" :key="si">
                  <span class="me-1 d-inline-block rounded" :style="legendSwatchStyle(s.color)"></span>
                  {{ s.label }}
                </span>
              </div>
            </div>
          </template>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeModal">Close</button>
        </div>
      </div>
    </div>
    </div>
  </Teleport>
</template>

<script>
/**
 * @module SpectralPlotModal
 * @description Modal canvas plots for emission, n(λ), filters, mirrors (wavelength vs property).
 */
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Simulator from '../../core/Simulator.js'
import { buildSpectralPlotData } from '../../core/spectralPlotSampler.js'
import { SPECTRAL_PLOT_EVENT } from '../../core/spectralPlotEvents.js'

function legendSwatchStyle(color) {
  return {
    width: '12px',
    height: '12px',
    backgroundColor: color || '#333',
    verticalAlign: 'middle'
  }
}

function drawPanel(canvas, panel, xMin, xMax) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const parent = canvas.parentElement
  const cssW = parent ? parent.clientWidth : 600
  const dpr = window.devicePixelRatio || 1
  const cssH = 220
  canvas.style.height = `${cssH}px`
  canvas.width = Math.floor(cssW * dpr)
  canvas.height = Math.floor(cssH * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const W = cssW
  const H = cssH
  const pad = { l: 52, r: 16, t: 14, b: 36 }
  const pw = W - pad.l - pad.r
  const ph = H - pad.t - pad.b

  let yMin = Infinity
  let yMax = -Infinity
  for (const s of panel.series) {
    for (const p of s.points) {
      if (!Number.isFinite(p.y)) continue
      yMin = Math.min(yMin, p.y)
      yMax = Math.max(yMax, p.y)
    }
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMin === yMax) {
    yMin = 0
    yMax = yMin === 0 ? 1 : yMin + 1
  }
  const yPad = (yMax - yMin) * 0.06
  yMin -= yPad
  yMax += yPad

  ctx.fillStyle = '#fafafa'
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = '#dee2e6'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad.l, pad.t)
  ctx.lineTo(pad.l, pad.t + ph)
  ctx.lineTo(pad.l + pw, pad.t + ph)
  ctx.stroke()

  ctx.fillStyle = '#6c757d'
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('λ (nm)', pad.l + pw / 2, H - 8)

  const nx = 5
  ctx.textAlign = 'center'
  ctx.fillStyle = '#adb5bd'
  for (let i = 0; i <= nx; i++) {
    const lam = xMin + (i / nx) * (xMax - xMin)
    const px = pad.l + (i / nx) * pw
    ctx.beginPath()
    ctx.moveTo(px, pad.t + ph)
    ctx.lineTo(px, pad.t + ph + 4)
    ctx.stroke()
    ctx.fillStyle = '#6c757d'
    ctx.fillText(String(Math.round(lam)), px, H - 22)
  }

  ctx.textAlign = 'right'
  ctx.fillStyle = '#6c757d'
  for (let i = 0; i <= 4; i++) {
    const vy = yMin + (i / 4) * (yMax - yMin)
    const py = pad.t + ph - (i / 4) * ph
    ctx.fillText(vy.toFixed(3), pad.l - 6, py + 4)
    ctx.strokeStyle = '#f1f3f5'
    ctx.beginPath()
    ctx.moveTo(pad.l, py)
    ctx.lineTo(pad.l + pw, py)
    ctx.stroke()
  }

  for (const s of panel.series) {
    ctx.strokeStyle = s.color || '#0d6efd'
    ctx.lineWidth = 2
    ctx.beginPath()
    let started = false
    for (const p of s.points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
      const px = pad.l + ((p.x - xMin) / (xMax - xMin)) * pw
      const py = pad.t + (1 - (p.y - yMin) / (yMax - yMin)) * ph
      if (!started) {
        ctx.moveTo(px, py)
        started = true
      } else {
        ctx.lineTo(px, py)
      }
    }
    ctx.stroke()
  }
}

export default {
  name: 'SpectralPlotModal',
  setup() {
    const bodyEl = ref(null)
    const isOpen = ref(false)
    const headerTitle = ref('Spectral plot')
    const headerSubtitle = ref('')
    const emptyMessage = ref('')
    const panels = ref([])

    const redraw = () => {
      const el = document.getElementById('spectralPlotModal')
      if (!el) return
      const canvases = el.querySelectorAll('canvas.spectral-plot-canvas')
      const list = panels.value
      const uv = Simulator.UV_WAVELENGTH
      const ir = Simulator.INFRARED_WAVELENGTH
      canvases.forEach((canvas, i) => {
        if (list[i]) {
          drawPanel(canvas, list[i], uv, ir)
        }
      })
    }

    const onResize = () => redraw()

    const closeModal = () => {
      const modalEl = document.getElementById('spectralPlotModal')
      if (!modalEl) return
      isOpen.value = false
      modalEl.classList.remove('show')
      modalEl.style.removeProperty('display')
      modalEl.setAttribute('aria-hidden', 'true')
      window.removeEventListener('resize', onResize)
    }

    const openHandler = (e) => {
      const { scene, obj } = e.detail || {}
      const data = buildSpectralPlotData(scene, obj)
      emptyMessage.value = ''
      if (!data) {
        panels.value = []
        headerTitle.value = 'Spectral plot'
        headerSubtitle.value = ''
        emptyMessage.value =
          'Nothing to plot. Turn on "Simulate Colors", enable filters, or pick a glass or light source with a spectrum.'
      } else {
        headerTitle.value = data.title
        headerSubtitle.value = data.subtitle || ''
        panels.value = data.panels || []
      }
      const modalEl = document.getElementById('spectralPlotModal')
      if (!modalEl) return
      isOpen.value = true
      modalEl.classList.add('show')
      modalEl.style.display = 'block'
      modalEl.removeAttribute('aria-hidden')
      modalEl.focus?.()
      nextTick(() => {
        redraw()
        window.addEventListener('resize', onResize)
      })
    }

    const onDocumentKeydown = (e) => {
      if (e.key === 'Escape' && isOpen.value) {
        e.preventDefault()
        closeModal()
      }
    }

    onMounted(() => {
      document.addEventListener(SPECTRAL_PLOT_EVENT, openHandler)
      document.addEventListener('keydown', onDocumentKeydown)
    })

    onBeforeUnmount(() => {
      document.removeEventListener(SPECTRAL_PLOT_EVENT, openHandler)
      document.removeEventListener('keydown', onDocumentKeydown)
      window.removeEventListener('resize', onResize)
    })

    return {
      bodyEl,
      isOpen,
      headerTitle,
      headerSubtitle,
      emptyMessage,
      panels,
      legendSwatchStyle,
      closeModal
    }
  }
}
</script>

<style scoped>
/* Bootstrap .modal uses pointer-events: none; backdrop would inherit and let clicks hit the canvas. */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.35);
  z-index: 1040;
  pointer-events: auto;
}

.modal-backdrop.show {
  opacity: 1;
}

.modal-dialog {
  z-index: 1055;
  position: relative;
  pointer-events: auto;
}
</style>

<style>
.spectral-plot-canvas {
  display: block;
}

/* When open, participate in hit-testing so backdrop/controls receive clicks (BS5 .modal { pointer-events: none }). */
#spectralPlotModal.spectral-plot-modal-root.show {
  display: block;
  pointer-events: auto;
}
</style>
