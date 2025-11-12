const EARTH_COORD_TOLERANCE = 1e-5

export const coordinatesMatch = (pointA, pointB, tolerance = EARTH_COORD_TOLERANCE) => {
  if (!pointA || !pointB) return false

  const latA = pointA.latitude
  const lonA = pointA.longitude
  const latB = pointB.latitude
  const lonB = pointB.longitude

  if (!isFinite(latA) || !isFinite(lonA) || !isFinite(latB) || !isFinite(lonB)) {
    return false
  }

  return Math.abs(latA - latB) <= tolerance && Math.abs(lonA - lonB) <= tolerance
}

export const getWaypointDisplayName = (route, waypoint, t = (key) => key) => {
  if (!waypoint) return ''

  const defaultName = waypoint.name || t('waypoint')
  const waypoints = route?.waypoints ?? []

  if (waypoint.isStartPoint) {
    const matchingWaypoint = waypoints.find(
      (wp) => wp.id !== waypoint.id && !wp.isStartPoint && coordinatesMatch(wp, waypoint)
    )

    if (matchingWaypoint) {
      return `${t('start')}: ${matchingWaypoint.name || t('waypoint')}`
    }

    if (waypoint.name && waypoint.name.trim() && waypoint.name !== 'Start') {
      return `${t('start')}: ${waypoint.name}`
    }

    return t('start')
  }

  if (waypoint.isEndPoint) {
    const matchingWaypoint = waypoints.find(
      (wp) => wp.id !== waypoint.id && !wp.isEndPoint && coordinatesMatch(wp, waypoint)
    )

    if (matchingWaypoint) {
      return `${t('end')}: ${matchingWaypoint.name || t('waypoint')}`
    }

    if (waypoint.name && waypoint.name.trim() && waypoint.name !== 'End') {
      return `${t('end')}: ${waypoint.name}`
    }

    return t('end')
  }

  return defaultName
}

