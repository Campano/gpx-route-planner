/**
 * Generate a seamlessly tileable contour-line SVG from a periodic height field.
 * Output: public/contour_map.svg (+ dark stroke variant)
 */

import { writeFileSync } from 'node:fs'

const W = 1000
const H = 700
const NX = 100
const NY = 70
const LEVELS = 16

/** Height field — periodic on [0,W]×[0,H] so tiles join at edges. */
function height(x, y) {
  const u = (x / W) * Math.PI * 2
  const v = (y / H) * Math.PI * 2
  return (
    Math.sin(u) * Math.cos(v) * 1.0 +
    Math.sin(2 * u + 1.1) * Math.sin(2 * v + 0.7) * 0.58 +
    Math.cos(3 * u - 2 * v + 0.4) * 0.36 +
    Math.sin(4 * u + 4 * v) * 0.22 +
    Math.cos(5 * u - v) * 0.12
  )
}

const xs = Array.from({ length: NX + 1 }, (_, i) => (i * W) / NX)
const ys = Array.from({ length: NY + 1 }, (_, j) => (j * H) / NY)
const grid = Array.from({ length: NX + 1 }, (_, i) =>
  Array.from({ length: NY + 1 }, (_, j) => height(xs[i], ys[j])),
)

let zMin = Infinity
let zMax = -Infinity
for (let i = 0; i <= NX; i++) {
  for (let j = 0; j <= NY; j++) {
    zMin = Math.min(zMin, grid[i][j])
    zMax = Math.max(zMax, grid[i][j])
  }
}

const edgePoint = (i, j, edge) => {
  switch (edge) {
    case 0:
      return [(xs[i] + xs[i + 1]) / 2, ys[j]]
    case 1:
      return [xs[i + 1], (ys[j] + ys[j + 1]) / 2]
    case 2:
      return [(xs[i] + xs[i + 1]) / 2, ys[j + 1]]
    case 3:
      return [xs[i], (ys[j] + ys[j + 1]) / 2]
    default:
      throw new Error(`bad edge ${edge}`)
  }
}

const lerp = (a, b, t) => a + (b - a) * t

function segmentOnEdge(i, j, edge, level) {
  let x0
  let y0
  let x1
  let y1
  let v0
  let v1

  if (edge === 0) {
    x0 = xs[i]
    y0 = ys[j]
    x1 = xs[i + 1]
    y1 = ys[j]
    v0 = grid[i][j]
    v1 = grid[i + 1][j]
  } else if (edge === 1) {
    x0 = xs[i + 1]
    y0 = ys[j]
    x1 = xs[i + 1]
    y1 = ys[j + 1]
    v0 = grid[i + 1][j]
    v1 = grid[i + 1][j + 1]
  } else if (edge === 2) {
    x0 = xs[i + 1]
    y0 = ys[j + 1]
    x1 = xs[i]
    y1 = ys[j + 1]
    v0 = grid[i + 1][j + 1]
    v1 = grid[i][j + 1]
  } else {
    x0 = xs[i]
    y0 = ys[j + 1]
    x1 = xs[i]
    y1 = ys[j]
    v0 = grid[i][j + 1]
    v1 = grid[i][j]
  }

  const t = (level - v0) / (v1 - v0)
  return [lerp(x0, x1, t), lerp(y0, y1, t)]
}

// Marching squares edge pairs per case (canonical table)
const MS = [
  [],
  [[0, 3]],
  [[0, 1]],
  [[1, 3]],
  [[1, 2]],
  [[0, 3], [1, 2]],
  [[0, 2]],
  [[2, 3]],
  [[2, 3]],
  [[0, 2]],
  [[0, 1], [2, 3]],
  [[1, 2]],
  [[1, 3]],
  [[0, 1]],
  [[0, 3]],
  [],
]

const quantize = (v) => Math.round(v * 1000) / 1000

function pointKey(x, y) {
  let qx = quantize(x)
  let qy = quantize(y)
  if (qx <= 0.001) qx = 0
  if (qx >= W - 0.001) qx = W
  if (qy <= 0.001) qy = 0
  if (qy >= H - 0.001) qy = H
  return `${qx},${qy}`
}

function collectSegments(level) {
  const segments = []
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NY; j++) {
      let caseIndex = 0
      if (grid[i][j] >= level) caseIndex |= 1
      if (grid[i + 1][j] >= level) caseIndex |= 2
      if (grid[i + 1][j + 1] >= level) caseIndex |= 4
      if (grid[i][j + 1] >= level) caseIndex |= 8

      for (const [e0, e1] of MS[caseIndex]) {
        const p0 = segmentOnEdge(i, j, e0, level)
        const p1 = segmentOnEdge(i, j, e1, level)
        segments.push([p0, p1])
      }
    }
  }
  return segments
}

function stitchPolylines(segments) {
  const adj = new Map()

  const addEdge = (a, b) => {
    const ka = pointKey(...a)
    const kb = pointKey(...b)
    if (!adj.has(ka)) adj.set(ka, [])
    if (!adj.has(kb)) adj.set(kb, [])
    adj.get(ka).push({ key: kb, point: b })
    adj.get(kb).push({ key: ka, point: a })
  }

  for (const [a, b] of segments) addEdge(a, b)

  const used = new Set()
  const polylines = []
  const edgeKey = (a, b) => [a, b].sort().join('|')
  const parse = (k) => k.split(',').map(Number)

  for (const [startKey, neighbors] of adj) {
    for (const { key: nextKey } of neighbors) {
      const ek = edgeKey(startKey, nextKey)
      if (used.has(ek)) continue

      const line = [parse(startKey)]
      let prev = startKey
      let curr = nextKey
      used.add(ek)

      while (curr !== startKey) {
        line.push(parse(curr))
        const options = (adj.get(curr) || []).filter((o) => o.key !== prev)
        let advanced = false
        for (const option of options) {
          const nk = edgeKey(curr, option.key)
          if (!used.has(nk)) {
            used.add(nk)
            prev = curr
            curr = option.key
            advanced = true
            break
          }
        }
        if (!advanced) break
      }

      if (line.length >= 2) polylines.push(line)
    }
  }

  return polylines
}

function polylineToPath(points) {
  if (points.length < 2) return ''
  const parts = points.map((p, i) =>
    i === 0 ? `M${quantize(p[0])},${quantize(p[1])}` : `L${quantize(p[0])},${quantize(p[1])}`,
  )
  const closed =
    points.length > 2 &&
    pointKey(points[0][0], points[0][1]) === pointKey(points.at(-1)[0], points.at(-1)[1])
  return closed ? `${parts.join('')}Z` : parts.join('')
}

function buildSvg(strokeColor, strokeOpacity) {
  const step = (zMax - zMin) / (LEVELS + 1)
  const paths = []

  for (let n = 1; n <= LEVELS; n++) {
    const level = zMin + step * n
    const segments = collectSegments(level)
    const polylines = stitchPolylines(segments)
    for (const line of polylines) {
      const d = polylineToPath(line)
      if (d) paths.push(d)
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none">
  <!-- Tileable contour lines from a periodic height field (${NX}×${NY} grid, ${LEVELS} levels) -->
  <g fill="none" stroke="${strokeColor}" stroke-width="0.75" stroke-opacity="${strokeOpacity}" stroke-linejoin="round" stroke-linecap="round">
${paths.map((d) => `    <path d="${d}"/>`).join('\n')}
  </g>
</svg>
`
}

writeFileSync('public/contour_map.svg', buildSvg('#3f6f52', 0.18))
writeFileSync('public/contour_map_dark.svg', buildSvg('#9bc4a8', 0.14))

console.log(`Wrote tileable contour_map.svg (${NX}×${NY} cells, ${LEVELS} levels)`)
