/**
 * Track preprocessing for track-based distance: resample, elevation smooth, deadband.
 * Adapted from Timewise-GPX (MIT) — applied to geometry only, not time.
 */

import { calculateDistance } from './trackProcessingUtils.js'

export const DEFAULT_TRACK_PROCESSING = {
  resampleSpacingM: 3,
  smoothWindowM: 15,
  elevationDeadbandM: 2,
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x))
}

function clampToOdd(val, minOdd, maxOdd) {
  let v = clamp(val, minOdd, maxOdd)
  if (v % 2 === 0) v += v >= maxOdd ? -1 : 1
  return v
}

/** Fill missing elevation by forward/backward pass. */
export function fillElevationOnPoints(points) {
  const out = points.map((p) => ({ ...p }))
  let last = null
  for (let i = 0; i < out.length; i++) {
    if (out[i].ele == null) out[i].ele = last
    else last = out[i].ele
  }
  let next = null
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].ele == null) out[i].ele = next
    else next = out[i].ele
  }
  return out
}

/** Resample polyline by target spacing (metres), linear interp lat/lon/ele. */
export function resampleByDistance(points, spacingM) {
  const spacing = Math.max(1, spacingM)
  const cum = [0]
  for (let i = 1; i < points.length; i++) {
    const d =
      calculateDistance(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon) *
      1000
    cum.push(cum[i - 1] + d)
  }
  const total = cum[cum.length - 1]
  if (!isFinite(total) || total === 0) {
    return points.slice(0, Math.min(points.length, 2))
  }

  const targets = []
  for (let s = 0; s <= total; s += spacing) targets.push(s)
  if (targets[targets.length - 1] < total) targets.push(total)

  const out = []
  let j = 1
  for (const t of targets) {
    while (j < cum.length && cum[j] < t) j++
    if (j >= cum.length) {
      out.push({ ...points[points.length - 1] })
      continue
    }
    const t0 = cum[j - 1]
    const t1 = cum[j]
    const p0 = points[j - 1]
    const p1 = points[j]
    const denom = t1 - t0 || 1
    const a = clamp((t - t0) / denom, 0, 1)

    const lat = p0.lat + a * (p1.lat - p0.lat)
    const lon = p0.lon + a * (p1.lon - p0.lon)
    const ele =
      p0.ele != null && p1.ele != null
        ? p0.ele + a * (p1.ele - p0.ele)
        : p0.ele != null
          ? p0.ele
          : p1.ele

    out.push({ lat, lon, ele })
  }
  return out
}

/** Median filter over an odd window (win). */
export function medianFilter(arr, win) {
  if (!Array.isArray(arr) || arr.length === 0) return arr.slice()
  const n = arr.length
  const half = Math.floor(win / 2)
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - half)
    const end = Math.min(n - 1, i + half)
    const vals = []
    for (let k = start; k <= end; k++) {
      if (arr[k] != null) vals.push(arr[k])
    }
    if (!vals.length) {
      out[i] = null
      continue
    }
    vals.sort((a, b) => a - b)
    const mid = Math.floor(vals.length / 2)
    out[i] = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
  }
  return out
}

/** Cumulative deadband on elevation to suppress tiny zig-zags. */
export function cumulativeDeadbandFilter(elev, deadband) {
  const n = elev.length
  if (n === 0) return []

  const out = new Array(n).fill(null)
  let first = elev[0]
  let i0 = 0
  while (first == null && i0 < n - 1) first = elev[++i0]
  if (first == null) return elev.slice()

  out[i0] = first
  let cumErr = 0

  for (let i = i0 + 1; i < n; i++) {
    const prev = elev[i - 1] ?? elev[i] ?? out[i - 1]
    const cur = elev[i] ?? prev
    const delta = cur - prev
    cumErr += delta

    if (Math.abs(cumErr) > deadband) {
      const move = cumErr - Math.sign(cumErr) * deadband
      out[i] = out[i - 1] + move
      cumErr = Math.sign(cumErr) * deadband
    } else {
      out[i] = out[i - 1]
    }
  }
  for (let k = 0; k < i0; k++) out[k] = out[i0]
  return out
}

/**
 * @param {Array<{latitude, longitude, elevation?}>} trackPoints
 * @param {{ resampleSpacingM?, smoothWindowM?, elevationDeadbandM? }} settings
 */
export function processTrackPoints(trackPoints, settings = {}) {
  const resampleSpacingM = Math.max(
    1,
    settings.resampleSpacingM ?? DEFAULT_TRACK_PROCESSING.resampleSpacingM
  )
  const smoothWindowM = Math.max(
    1,
    settings.smoothWindowM ?? DEFAULT_TRACK_PROCESSING.smoothWindowM
  )
  const elevationDeadbandM = Math.max(
    0,
    settings.elevationDeadbandM ?? DEFAULT_TRACK_PROCESSING.elevationDeadbandM
  )

  if (!Array.isArray(trackPoints) || trackPoints.length < 2) {
    return {
      points: trackPoints ?? [],
      originalPointCount: trackPoints?.length ?? 0,
      processedPointCount: trackPoints?.length ?? 0,
      resampleSpacingM,
      smoothWindowM,
      elevationDeadbandM,
    }
  }

  const raw = trackPoints.map((p) => ({
    lat: p.latitude,
    lon: p.longitude,
    ele: isFinite(p.elevation) ? p.elevation : null,
  }))

  const filled = fillElevationOnPoints(raw)
  const resampled = resampleByDistance(filled, resampleSpacingM)
  if (resampled.length < 2) {
    return {
      points: trackPoints,
      originalPointCount: trackPoints.length,
      processedPointCount: trackPoints.length,
      resampleSpacingM,
      smoothWindowM,
      elevationDeadbandM,
    }
  }

  const winSamples = clampToOdd(Math.max(3, Math.round(smoothWindowM / resampleSpacingM)), 3, 999)
  const elev = resampled.map((p) => p.ele)
  const elevSmooth = medianFilter(elev, winSamples)
  const elevFiltered = cumulativeDeadbandFilter(elevSmooth, elevationDeadbandM)

  const points = resampled.map((p, i) => ({
    latitude: p.lat,
    longitude: p.lon,
    elevation: elevFiltered[i] ?? p.ele ?? 0,
  }))

  return {
    points,
    originalPointCount: trackPoints.length,
    processedPointCount: points.length,
    resampleSpacingM,
    smoothWindowM,
    elevationDeadbandM,
  }
}
