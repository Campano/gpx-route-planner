import { describe, it, expect } from 'vitest'
import { getLegDescription, getStartDisplayName, getPointLabel } from './waypointUtils.js'

const t = (key) =>
  ({
    start: 'Start',
    end: 'End',
    waypoint: 'Waypoint',
  })[key] ?? key

describe('waypointUtils', () => {
  const route = {
    waypoints: [
      {
        id: 'start',
        name: 'Start',
        isStartPoint: true,
        latitude: 45,
        longitude: 7,
      },
      {
        id: 'refuge',
        name: 'Refuge',
        latitude: 45.01,
        longitude: 7.01,
      },
      {
        id: 'end',
        name: 'End',
        isEndPoint: true,
        latitude: 45.02,
        longitude: 7.02,
      },
    ],
  }

  it('first row shows only Start when no matching waypoint', () => {
    expect(getLegDescription(route, 0, t)).toBe('Start')
    expect(getStartDisplayName(route, route.waypoints[0], t)).toBe('Start')
  })

  it('first row uses nearby waypoint name when start aligns with one', () => {
    const aligned = {
      waypoints: [
        { id: 'start', name: 'Start', isStartPoint: true, latitude: 45, longitude: 7 },
        { id: 'trailhead', name: 'Trailhead', latitude: 45.00001, longitude: 7.00001 },
        { id: 'summit', name: 'Summit', latitude: 45.1, longitude: 7.1 },
      ],
    }
    expect(getLegDescription(aligned, 0, t)).toBe('Trailhead')
  })

  it('later rows use origin → destination', () => {
    expect(getLegDescription(route, 1, t)).toBe('Start → Refuge')
    expect(getLegDescription(route, 2, t)).toBe('Refuge → End')
  })

  it('appends (End) when last waypoint is merged with route end', () => {
    const merged = {
      waypoints: [
        { id: 'start', name: 'Start', isStartPoint: true, latitude: 45, longitude: 7 },
        { id: 'summit', name: 'Summit', isEndPoint: true, latitude: 45.02, longitude: 7.02 },
      ],
    }
    expect(getPointLabel(merged, merged.waypoints[1], t)).toBe('Summit (End)')
    expect(getLegDescription(merged, 1, t)).toBe('Start → Summit (End)')
  })

  it('appends (End) when last waypoint is co-located with end row', () => {
    const coLocated = {
      waypoints: [
        { id: 'start', name: 'Start', isStartPoint: true, latitude: 45, longitude: 7 },
        { id: 'refuge', name: 'Refuge', latitude: 45.02, longitude: 7.02 },
        {
          id: 'end',
          name: 'End',
          isEndPoint: true,
          latitude: 45.02001,
          longitude: 7.02001,
        },
      ],
    }
    expect(getPointLabel(coLocated, coLocated.waypoints[1], t)).toBe('Refuge')
    expect(getLegDescription(coLocated, 2, t)).toBe('Start → Refuge (End)')
  })

  it('getPointLabel matches leg endpoints', () => {
    expect(getPointLabel(route, route.waypoints[1], t)).toBe('Refuge')
  })
})
