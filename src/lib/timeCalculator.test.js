import { describe, it, expect } from 'vitest'
import {
  calculateSegmentTime,
  calculateSegmentTimeAdditive,
  calculateSegmentTimeActivityBlend,
  calculateSegmentTimeActivityBlendAggregated,
  calculateActivityBlendTimeFromPathPoints,
  TIME_CALCULATION_METHODS,
} from './timeCalculator.js'

const speeds = {
  ascentSpeed: 300,
  descentSpeed: 500,
  flatSpeed: 4000,
  downhillFactor: 2 / 3,
}

describe('calculateSegmentTimeAdditive', () => {
  it('sums flat, ascent, and descent times independently', () => {
    // 1 km flat: 0.25 h; 300 m up: 1 h; 200 m down: 0.4 h → 1.65 h = 99 min
    const minutes = calculateSegmentTimeAdditive(1, 300, 200, speeds)
    expect(minutes).toBeCloseTo(99, 5)
  })
})

describe('calculateSegmentTimeActivityBlendAggregated', () => {
  it('uses max + 0.5×min when climbing dominates', () => {
    const minutes = calculateSegmentTimeActivityBlendAggregated(1, 300, 0, speeds)
    expect(minutes).toBeCloseTo(67.5, 5)
  })

  it('applies downhill factor when descent dominates', () => {
    const minutes = calculateSegmentTimeActivityBlendAggregated(1, 0, 300, speeds)
    expect(minutes).toBeCloseTo(29, 0)
  })
})

describe('calculateActivityBlendTimeFromPathPoints', () => {
  it('sums blend per step along a path', () => {
    const path = [
      { latitude: 0, longitude: 0, elevation: 0 },
      { latitude: 0.001, longitude: 0, elevation: 50 },
      { latitude: 0.002, longitude: 0, elevation: 0 },
    ]
    const minutes = calculateActivityBlendTimeFromPathPoints(path, speeds)
    expect(minutes).toBeGreaterThan(0)
  })
})

describe('calculateSegmentTimeActivityBlend', () => {
  it('uses path-based sum when pathPoints are provided', () => {
    const path = [
      { latitude: 0, longitude: 0, elevation: 0 },
      { latitude: 0.01, longitude: 0, elevation: 100 },
    ]
    const withPath = calculateSegmentTimeActivityBlend(1, 100, 0, speeds, path)
    const aggregated = calculateSegmentTimeActivityBlendAggregated(1, 100, 0, speeds)
    expect(withPath).not.toBeCloseTo(aggregated, 0)
  })
})

describe('calculateSegmentTime', () => {
  it('defaults to blended aggregated time when method is omitted and no path', () => {
    const blend = calculateSegmentTimeActivityBlendAggregated(1, 300, 0, speeds)
    const implicit = calculateSegmentTime(1, 300, 0, { ...speeds })
    expect(implicit).toBeCloseTo(blend, 5)
  })

  it('dispatches by timeCalculationMethod', () => {
    const additive = calculateSegmentTime(1, 300, 200, {
      ...speeds,
      timeCalculationMethod: TIME_CALCULATION_METHODS.ADDITIVE,
    })
    const blend = calculateSegmentTime(1, 300, 0, {
      ...speeds,
      timeCalculationMethod: TIME_CALCULATION_METHODS.ACTIVITY_BLEND,
    })
    expect(additive).toBeCloseTo(99, 5)
    expect(blend).toBeCloseTo(67.5, 5)
  })
})
