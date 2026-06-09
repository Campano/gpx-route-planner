import { describe, it, expect } from 'vitest'
import { buildElevationProfile } from './elevationProfile.js'

describe('buildElevationProfile', () => {
  it('builds profile from processed track with waypoint markers at track distance', () => {
    const route = {
      processedTrackPoints: [
        { latitude: 0, longitude: 0, elevation: 100 },
        { latitude: 0.01, longitude: 0, elevation: 150 },
        { latitude: 0.02, longitude: 0, elevation: 120 },
      ],
      waypoints: [
        {
          id: 'start',
          latitude: 0,
          longitude: 0,
          elevation: 100,
          totalDistance: 0,
          isStartPoint: true,
          name: 'Trailhead',
        },
        {
          id: 'summit',
          latitude: 0.01,
          longitude: 0,
          elevation: 150,
          totalDistance: 1.1,
          name: 'Summit',
        },
      ],
    }

    const result = buildElevationProfile(route, (wp) => wp.name)
    expect(result).not.toBeNull()
    expect(result.profile.length).toBe(3)
    expect(result.profile[0].distanceKm).toBe(0)
    expect(result.profile[2].elevation).toBe(120)
    expect(result.waypointMarkers).toHaveLength(2)
    expect(result.waypointMarkers[0].name).toBe('Trailhead')
    expect(result.waypointMarkers[1].distanceKm).toBeGreaterThan(0)
    expect(result.waypointMarkers[1].elevation).toBe(150)
  })

  it('falls back to waypoint polyline when no track is available', () => {
    const route = {
      waypoints: [
        { id: 'a', latitude: 0, longitude: 0, elevation: 200, totalDistance: 0 },
        { id: 'b', latitude: 1, longitude: 1, elevation: 400, totalDistance: 2.5 },
        { id: 'c', latitude: 2, longitude: 2, elevation: 300, totalDistance: 5 },
      ],
    }

    const result = buildElevationProfile(route, (wp) => wp.id)
    expect(result.profile).toHaveLength(3)
    expect(result.profile.map((p) => p.distanceKm)).toEqual([0, 2.5, 5])
    expect(result.waypointMarkers).toHaveLength(3)
  })

  it('returns null when insufficient data', () => {
    expect(buildElevationProfile({ waypoints: [] })).toBeNull()
    expect(
      buildElevationProfile({
        waypoints: [{ id: 'only', latitude: 0, longitude: 0, elevation: 100, totalDistance: 0 }],
      }),
    ).toBeNull()
  })
})
