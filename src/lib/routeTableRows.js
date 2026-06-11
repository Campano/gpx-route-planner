/**
 * Rest rows and flat table row model for route timing display.
 */

import { getPointLabel } from './waypointUtils.js'

/**
 * @typedef {Object} Rest
 * @property {string} id
 * @property {number} durationMinutes
 * @property {number} [totalTime] Cumulative minutes from route start (after rest).
 * @property {number} [segmentTime]
 * @property {string} [hour]
 * @property {string} [departureHour]
 */

/**
 * @typedef {Object} Waypoint
 * @property {string} [id]
 * @property {string} [name]
 * @property {number} [stopDuration] Legacy single rest duration in minutes.
 * @property {Rest[]} [rests]
 * @property {number} [totalTime] Cumulative minutes from route start (on arrival).
 */

/**
 * @typedef {Object} WaypointTableRow
 * @property {'waypoint'} rowType
 * @property {Waypoint} waypoint
 * @property {number} waypointIndex
 * @property {null} rest
 */

/**
 * @typedef {Object} RestTableRow
 * @property {'rest'} rowType
 * @property {Waypoint} waypoint Parent checkpoint for this rest.
 * @property {number} waypointIndex
 * @property {Rest} rest
 */

/** @typedef {WaypointTableRow | RestTableRow} RouteTableRow */

/**
 * Create a unique id for a rest entry.
 * @returns {string}
 */
export function createRestId() {
  return `rest-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Migrate legacy `stopDuration` on a waypoint into `rests[]`.
 * @param {Waypoint} waypoint
 * @returns {Waypoint}
 */
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

/**
 * Normalize rests on every waypoint in a route.
 * @param {Waypoint[]} [waypoints]
 * @returns {Waypoint[]}
 */
export function normalizeRouteWaypoints(waypoints) {
  return (waypoints ?? []).map(normalizeWaypointRests)
}

/**
 * Flatten waypoints into alternating waypoint and rest rows for the timing table.
 * @param {Waypoint[]} [waypoints]
 * @returns {RouteTableRow[]}
 */
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

/**
 * Latest cumulative minute mark on the route (after all rests).
 * @param {Waypoint[]} [waypoints]
 * @returns {number}
 */
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

/**
 * Localized label for a rest row (e.g. "Rest at Refuge").
 * @param {{ waypoints?: Waypoint[] }} route
 * @param {Waypoint} waypoint
 * @param {(key: string) => string} [t]
 * @returns {string}
 */
export function getRestLabel(route, waypoint, t = (key) => key) {
  const name = getPointLabel(route, waypoint, t)
  const template = t('restAt')
  return template.includes('{name}') ? template.replace('{name}', name) : `${template} ${name}`
}

/**
 * Progress along the route as a percentage of total elapsed time.
 * @param {number} rowTime
 * @param {number} routeEndTime
 * @returns {number} 0–100
 */
export function getRowProgressionPercent(rowTime, routeEndTime) {
  if (!routeEndTime || routeEndTime <= 0 || !isFinite(rowTime)) return 0
  return Math.round((rowTime / routeEndTime) * 100)
}

/**
 * Cumulative minutes used for progression on a table row.
 * @param {RouteTableRow} row
 * @returns {number}
 */
export function getRowTimingMinutes(row) {
  if (row.rowType === 'rest') {
    return row.rest?.totalTime ?? 0
  }
  return row.waypoint?.totalTime ?? 0
}
