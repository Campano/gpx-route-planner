import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseGPXFile } from './calculationService.js'
import {
  calculateSegmentTimeActivityBlend,
  calculateSegmentTimeActivityBlendAggregated,
  calculateActivityBlendTimeFromPathPoints,
} from './timeCalculator.js'
import { getTrackPathBetweenWaypoints } from './gpxParser.js'
import { createDefaultRouteSettings } from './routeDefaults.js'

const gpxPath = resolve(import.meta.dirname, '../../test-data/albufera_menorca.gpx')
const settings = createDefaultRouteSettings('hiking')
settings.timeCalculationMethod = 'activity_blend'

describe('albufera_menorca segment time vs Timewise', () => {
  it('per-step blend along track matches Timewise (~40 min) better than aggregated (~24 min)', () => {
    const gpx = readFileSync(gpxPath, 'utf8')
    const route = parseGPXFile(gpx, settings)
    const wps = route.waypoints
    const idx = wps.findIndex((wp) => wp.name?.includes('Cala Tamarells'))
    expect(idx).toBeGreaterThan(0)
    const wp = wps[idx]
    const prev = wps[idx - 1]

    const path = getTrackPathBetweenWaypoints(
      route.processedTrackPoints,
      prev.latitude,
      prev.longitude,
      wp.latitude,
      wp.longitude,
    )

    const perStep = calculateActivityBlendTimeFromPathPoints(path, settings)
    const aggregated = calculateSegmentTimeActivityBlendAggregated(
      wp.segmentDistance,
      wp.segmentAscent,
      wp.segmentDescent,
      settings,
    )
    const fromRecalc = wp.segmentTime

    expect(perStep).toBeGreaterThan(35)
    expect(perStep).toBeLessThan(45)
    expect(aggregated).toBeLessThan(30)
    expect(fromRecalc).toBeCloseTo(perStep, 0)
  })

  it('recalculates segment time when descent or flat speed settings change', () => {
    const gpx = readFileSync(gpxPath, 'utf8')
    const route = parseGPXFile(gpx, settings)
    const idx = wpsIndex(route, 'Cala Tamarells')
    const wp = route.waypoints[idx]
    const prev = route.waypoints[idx - 1]
    const path = getTrackPathBetweenWaypoints(
      route.processedTrackPoints,
      prev.latitude,
      prev.longitude,
      wp.latitude,
      wp.longitude,
    )

    const baseline = calculateActivityBlendTimeFromPathPoints(path, settings)
    const slowerDescent = calculateActivityBlendTimeFromPathPoints(path, {
      ...settings,
      descentSpeed: 250,
    })
    const slowerFlat = calculateActivityBlendTimeFromPathPoints(path, {
      ...settings,
      flatSpeed: 2500,
    })

    expect(slowerDescent).toBeGreaterThan(baseline)
    expect(slowerFlat).toBeGreaterThan(baseline)
  })
})

function wpsIndex(route, namePart) {
  const idx = route.waypoints.findIndex((wp) => wp.name?.includes(namePart))
  expect(idx).toBeGreaterThan(0)
  return idx
}
