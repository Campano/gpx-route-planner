import { describe, it, expect } from 'vitest'
import {
  processTrackPoints,
  resampleByDistance,
  cumulativeDeadbandFilter,
} from './trackProcessing.js'

describe('trackProcessing', () => {
  it('resamples a simple line to roughly uniform spacing', () => {
    const points = [
      { lat: 45, lon: 7, ele: 1000 },
      { lat: 45.001, lon: 7, ele: 1010 },
      { lat: 45.002, lon: 7, ele: 1020 },
    ]
    const out = resampleByDistance(points, 50)
    expect(out.length).toBeGreaterThan(3)
  })

  it('processTrackPoints increases point count vs sparse input', () => {
    const sparse = Array.from({ length: 10 }, (_, i) => ({
      latitude: 45 + i * 0.0001,
      longitude: 7,
      elevation: 1000 + i * 5,
    }))
    const result = processTrackPoints(sparse, {
      resampleSpacingM: 3,
      smoothWindowM: 15,
      elevationDeadbandM: 2,
    })
    expect(result.processedPointCount).toBeGreaterThan(result.originalPointCount)
    expect(result.points[0]).toHaveProperty('latitude')
    expect(result.points[0]).toHaveProperty('elevation')
  })

  it('deadband suppresses small elevation noise', () => {
    const elev = [100, 100.5, 101, 101.2, 105]
    const filtered = cumulativeDeadbandFilter(elev, 2)
    expect(filtered[filtered.length - 1]).toBeGreaterThan(100)
  })
})
