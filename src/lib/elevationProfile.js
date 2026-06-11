import { calculateDistance } from './utils.js'

function findNearestTrackPointIndex(trackPoints, latitude, longitude) {
  if (!Array.isArray(trackPoints) || trackPoints.length === 0) {
    return null
  }

  let bestIndex = null
  let bestDistance = Infinity

  trackPoints.forEach((trackPoint, index) => {
    if (!isFinite(trackPoint?.latitude) || !isFinite(trackPoint?.longitude)) {
      return
    }

    const distance = calculateDistance(
      latitude,
      longitude,
      trackPoint.latitude,
      trackPoint.longitude,
    )

    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })

  return bestIndex
}

function distanceAtTrackIndex(trackPoints, index) {
  let cumDist = 0
  for (let i = 1; i <= index; i++) {
    const prev = trackPoints[i - 1]
    const current = trackPoints[i]
    if (
      !isFinite(prev?.latitude) ||
      !isFinite(prev?.longitude) ||
      !isFinite(current?.latitude) ||
      !isFinite(current?.longitude)
    ) {
      continue
    }
    cumDist += calculateDistance(
      prev.latitude,
      prev.longitude,
      current.latitude,
      current.longitude,
    )
  }
  return cumDist
}

function fillElevationGaps(profile) {
  if (profile.length === 0) return profile

  const filled = profile.map((point) => ({ ...point }))
  let lastKnown = null

  for (const point of filled) {
    if (isFinite(point.elevation)) {
      lastKnown = point.elevation
    } else if (lastKnown !== null) {
      point.elevation = lastKnown
    }
  }

  let nextKnown = null
  for (let i = filled.length - 1; i >= 0; i--) {
    if (isFinite(filled[i].elevation)) {
      nextKnown = filled[i].elevation
    } else if (nextKnown !== null) {
      filled[i].elevation = nextKnown
    }
  }

  return filled.filter((point) => isFinite(point.elevation))
}

export function getRouteTrackPoints(route) {
  if (Array.isArray(route?.processedTrackPoints) && route.processedTrackPoints.length >= 2) {
    return route.processedTrackPoints
  }

  const tracks = route?.gpxData?.tracks ?? []
  const points = tracks.flatMap((track) => track.points ?? [])
  return points.length >= 2 ? points : null
}

function buildProfileFromTrack(trackPoints) {
  const profile = []
  let cumDist = 0

  for (let i = 0; i < trackPoints.length; i++) {
    const point = trackPoints[i]
    if (i > 0) {
      const prev = trackPoints[i - 1]
      if (
        isFinite(prev?.latitude) &&
        isFinite(prev?.longitude) &&
        isFinite(point?.latitude) &&
        isFinite(point?.longitude)
      ) {
        cumDist += calculateDistance(
          prev.latitude,
          prev.longitude,
          point.latitude,
          point.longitude,
        )
      }
    }

    profile.push({
      distanceKm: cumDist,
      elevation: isFinite(point?.elevation) ? point.elevation : null,
    })
  }

  return fillElevationGaps(profile)
}

function buildProfileFromWaypoints(waypoints) {
  return (waypoints ?? [])
    .filter((wp) => isFinite(wp?.latitude) && isFinite(wp?.longitude))
    .map((wp) => ({
      distanceKm: isFinite(wp.totalDistance) ? wp.totalDistance : 0,
      elevation: isFinite(wp.elevation) ? wp.elevation : null,
    }))
    .filter((point) => isFinite(point.elevation))
}

function buildWaypointMarkers(route, trackPoints, getWaypointLabel) {
  const waypoints = route?.waypoints ?? []
  const markers = []

  for (const wp of waypoints) {
    if (!isFinite(wp.latitude) || !isFinite(wp.longitude)) continue

    let distanceKm = isFinite(wp.totalDistance) ? wp.totalDistance : 0
    let elevation = wp.elevation

    if (trackPoints && trackPoints.length > 0) {
      const index = findNearestTrackPointIndex(trackPoints, wp.latitude, wp.longitude)
      if (index !== null) {
        distanceKm = distanceAtTrackIndex(trackPoints, index)
        if (!isFinite(elevation) && isFinite(trackPoints[index]?.elevation)) {
          elevation = trackPoints[index].elevation
        }
      }
    }

    if (!isFinite(distanceKm) || !isFinite(elevation)) continue

    markers.push({
      id: wp.id,
      distanceKm,
      elevation,
      name: getWaypointLabel(wp) || wp.name || '',
      isStartPoint: Boolean(wp.isStartPoint),
      isEndPoint: Boolean(wp.isEndPoint),
      isDecisionPoint: Boolean(wp.isDecisionPoint),
    })
  }

  return markers
}

/**
 * @param {Object} route
 * @param {(waypoint: Object) => string} getWaypointLabel
 * @returns {{ profile: Array<{distanceKm: number, elevation: number}>, waypointMarkers: Array }|null}
 */
export function buildElevationProfile(route, getWaypointLabel = () => '') {
  const trackPoints = getRouteTrackPoints(route)
  const profile = trackPoints
    ? buildProfileFromTrack(trackPoints)
    : buildProfileFromWaypoints(route?.waypoints ?? [])

  if (profile.length < 2) {
    return null
  }

  return {
    profile,
    waypointMarkers: buildWaypointMarkers(route, trackPoints, getWaypointLabel),
  }
}
