/**
 * Rest rows and flat table row model for route timing display.
 */

import { getPointLabel } from './waypointUtils.js'

export function createRestId() {
  return `rest-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Migrate legacy stopDuration on a waypoint into rests[]. */
export function normalizeWaypointRests(waypoint) {
  const rests = Array.isArray(waypoint.rests) ? waypoint.rests.map((r) => ({ ...r })) : []
  if (rests.length === 0 && (waypoint.stopDuration || 0) > 0) {
    rests.push({
      id: createRestId(),
      durationMinutes: waypoint.stopDuration,
    })
  }
  if (rests.length > 1) {
    rests.splice(1)
  }
  const { stopDuration: _legacy, ...withoutLegacy } = waypoint
  return { ...withoutLegacy, rests }
}

export function normalizeRouteWaypoints(waypoints) {
  return (waypoints ?? []).map(normalizeWaypointRests)
}

export function buildRouteTableRows(waypoints) {
  const rows = []
  ;(waypoints ?? []).forEach((waypoint, waypointIndex) => {
    rows.push({ rowType: 'waypoint', waypoint, waypointIndex, rest: null })
    for (const rest of waypoint.rests ?? []) {
      rows.push({ rowType: 'rest', waypoint, waypointIndex, rest })
    }
  })
  return rows
}

/** Latest cumulative minute mark on the route (after all rests). */
export function getRouteEndTime(waypoints) {
  let end = 0
  for (const wp of waypoints ?? []) {
    if ((wp.totalTime ?? 0) > end) end = wp.totalTime
    for (const rest of wp.rests ?? []) {
      if ((rest.totalTime ?? 0) > end) end = rest.totalTime
    }
  }
  return end
}

export function getRestLabel(route, waypoint, t = (key) => key) {
  const name = getPointLabel(route, waypoint, t)
  const template = t('restAt')
  return template.includes('{name}') ? template.replace('{name}', name) : `${template} ${name}`
}

export function getRowProgressionPercent(rowTime, routeEndTime) {
  if (!routeEndTime || routeEndTime <= 0 || !isFinite(rowTime)) return 0
  return Math.round((rowTime / routeEndTime) * 100)
}

/** Cumulative minutes used for progression on a table row. */
export function getRowTimingMinutes(row) {
  if (row.rowType === 'rest') {
    return row.rest?.totalTime ?? 0
  }
  return row.waypoint?.totalTime ?? 0
}
