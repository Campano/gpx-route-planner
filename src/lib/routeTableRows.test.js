import { describe, expect, it } from 'vitest'
import { recalculateWaypoints } from './timeCalculator.js'
import {
  buildRouteTableRows,
  getRouteEndTime,
  getRestLabel,
  normalizeWaypointRests,
} from './routeTableRows.js'

const settings = { startTime: '08:00', ascentSpeed: 300, descentSpeed: 500, flatSpeed: 4000 }

describe('routeTableRows', () => {
  it('migrates stopDuration into rests', () => {
    const wp = normalizeWaypointRests({ id: 'a', stopDuration: 20, rests: undefined })
    expect(wp.rests).toHaveLength(1)
    expect(wp.rests[0].durationMinutes).toBe(20)
    expect(wp.stopDuration).toBeUndefined()
  })

  it('places rests after their waypoint in table rows', () => {
    const waypoints = recalculateWaypoints(
      [
        { id: '0', segmentDistance: 0, segmentAscent: 0, segmentDescent: 0, terrainDifficultyPenalty: 0, rests: [] },
        {
          id: '1',
          name: 'Hut',
          segmentDistance: 1,
          segmentAscent: 100,
          segmentDescent: 0,
          terrainDifficultyPenalty: 0,
          rests: [{ id: 'r1', durationMinutes: 30 }],
        },
      ],
      settings,
    )
    const rows = buildRouteTableRows(waypoints)
    expect(rows).toHaveLength(3)
    expect(rows[0].rowType).toBe('waypoint')
    expect(rows[1].rowType).toBe('waypoint')
    expect(rows[2].rowType).toBe('rest')
    expect(rows[2].rest.hour).toBeDefined()
    expect(rows[2].rest.departureHour).toBeDefined()
  })

  it('computes route end time after rests', () => {
    const waypoints = recalculateWaypoints(
      [
        { id: '0', segmentDistance: 0, segmentAscent: 0, segmentDescent: 0, terrainDifficultyPenalty: 0, rests: [] },
        {
          id: '1',
          segmentDistance: 1,
          segmentAscent: 0,
          segmentDescent: 0,
          terrainDifficultyPenalty: 0,
          rests: [{ id: 'r1', durationMinutes: 10 }],
        },
      ],
      settings,
    )
    const end = getRouteEndTime(waypoints)
    expect(end).toBeGreaterThan(waypoints[1].totalTime)
    expect(end).toBe(waypoints[1].rests[0].totalTime)
  })

  it('formats rest label', () => {
    const route = { waypoints: [{ id: '1', name: 'Refuge' }] }
    const label = getRestLabel(route, route.waypoints[0], (k) => (k === 'restAt' ? 'REST at {name}' : k))
    expect(label).toBe('REST at Refuge')
  })
})
