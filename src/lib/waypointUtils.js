import { PROXIMITY_THRESHOLD_M } from './proximityConstants.js'

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const coordinatesMatch = (pointA, pointB, maxDistanceM = PROXIMITY_THRESHOLD_M) => {
  if (!pointA || !pointB) return false

  const latA = pointA.latitude
  const lonA = pointA.longitude
  const latB = pointB.latitude
  const lonB = pointB.longitude

  if (!isFinite(latA) || !isFinite(lonA) || !isFinite(latB) || !isFinite(lonB)) {
    return false
  }

  return haversineMeters(latA, lonA, latB, lonB) <= maxDistanceM
}

const findMatchingWaypointAtSameLocation = (route, waypoint, excludeFlags = {}) => {
  const waypoints = route?.waypoints ?? []
  return waypoints.find(
    (wp) =>
      wp.id !== waypoint.id &&
      !excludeFlags.start?.(wp) &&
      !excludeFlags.end?.(wp) &&
      coordinatesMatch(wp, waypoint)
  )
}

/** Start row: "Start" or the nearby GPX waypoint name only (no "Start:" prefix). */
export const getStartDisplayName = (route, waypoint, t = (key) => key) => {
  if (!waypoint) return ''

  const matchingWaypoint = findMatchingWaypointAtSameLocation(route, waypoint, {
    start: (wp) => wp.isStartPoint,
    end: () => false,
  })

  if (matchingWaypoint?.name?.trim()) {
    return matchingWaypoint.name.trim()
  }

  const name = waypoint.name?.trim()
  if (name && name !== 'Start') {
    return name
  }

  return t('start')
}

const formatNameWithEndSuffix = (name, t) => {
  const trimmed = name?.trim()
  if (!trimmed) return t('end')
  const endLabel = t('end')
  if (trimmed === endLabel || trimmed === 'End') {
    return endLabel
  }
  return `${trimmed} (${endLabel})`
}

/** True when this checkpoint should show the merged "(End)" suffix on its label. */
export const isWaypointAtRouteEnd = (route, waypoint) => {
  if (!waypoint) return false
  if (waypoint.isEndPoint) return true

  const waypoints = route?.waypoints ?? []
  const idx = waypoints.findIndex((wp) => wp.id === waypoint.id)
  const next = waypoints[idx + 1]
  // Penultimate row co-located with End: suffix appears on the leg destination only.
  if (next?.isEndPoint && coordinatesMatch(waypoint, next)) {
    return false
  }

  const endWaypoint = waypoints.find((wp) => wp.isEndPoint)
  if (!endWaypoint || endWaypoint.id === waypoint.id) return false

  return coordinatesMatch(waypoint, endWaypoint)
}

/** End: "End", or nearby / merged waypoint name with "(End)" suffix. */
export const getEndDisplayName = (route, waypoint, t = (key) => key) => {
  if (!waypoint) return ''

  const matchingWaypoint = findMatchingWaypointAtSameLocation(route, waypoint, {
    start: () => false,
    end: (wp) => wp.isEndPoint,
  })

  if (matchingWaypoint?.name?.trim()) {
    return formatNameWithEndSuffix(matchingWaypoint.name, t)
  }

  const name = waypoint.name?.trim()
  if (name && name !== 'End' && name !== t('end')) {
    return formatNameWithEndSuffix(name, t)
  }

  return t('end')
}

/** Single checkpoint label (map, tooltips). */
export const getPointLabel = (route, waypoint, t = (key) => key) => {
  if (!waypoint) return ''

  if (waypoint.isStartPoint) {
    return getStartDisplayName(route, waypoint, t)
  }

  if (waypoint.isEndPoint) {
    return getEndDisplayName(route, waypoint, t)
  }

  const name = waypoint.name?.trim() || t('waypoint')
  if (isWaypointAtRouteEnd(route, waypoint)) {
    return formatNameWithEndSuffix(name === t('waypoint') ? '' : name, t)
  }

  return name
}

/**
 * Table row label: first row is start only; others are "origin → destination".
 */
export const getLegDescription = (route, waypointIndex, t = (key) => key) => {
  const waypoints = route?.waypoints ?? []
  const waypoint = waypoints[waypointIndex]
  if (!waypoint) return ''

  if (waypointIndex === 0) {
    return getStartDisplayName(route, waypoint, t)
  }

  const previous = waypoints[waypointIndex - 1]

  if (waypoint.isEndPoint && coordinatesMatch(previous, waypoint)) {
    const origin =
      waypointIndex >= 2
        ? getPointLabel(route, waypoints[waypointIndex - 2], t)
        : getStartDisplayName(route, waypoints[0], t)
    const destination = getEndDisplayName(route, waypoint, t)
    return `${origin} → ${destination}`
  }

  const origin = getPointLabel(route, previous, t)
  const destination = getPointLabel(route, waypoint, t)
  return `${origin} → ${destination}`
}

/** @deprecated Use getPointLabel for markers or getLegDescription for table rows. */
export const getWaypointDisplayName = (route, waypoint, t = (key) => key) => {
  return getPointLabel(route, waypoint, t)
}
