/**
 * Calculation Service - Orchestrates GPX parsing and time calculations
 * Separates concerns: geometry parsing (gpxParser) and time calculations (timeCalculator)
 */

import { parseGPXGeometry, recalculateWaypointGeometry } from './gpxParser.js'
import {
  recalculateWaypoints as recalculateWaypointTimes,
  formatTimeHoursMinutes,
  formatTimeHoursMinutesForMin,
  formatTotalTimeWithPercentage
} from './timeCalculator.js'

/**
 * Parse GPX file and calculate all metrics (geometry + time)
 * @param {string} gpxContent - GPX file content
 * @param {Object} settings - User settings including speed settings
 * @returns {Object} Parsed route with waypoints containing geometry and time metrics
 */
export function parseGPXFile(gpxContent, settings) {
  // Parse geometry only (no time calculations)
  const geometry = parseGPXGeometry(gpxContent, settings)
  
  // Add time calculations to waypoints
  const waypointsWithTime = recalculateWaypointTimes(geometry.waypoints, settings)
  
  // Get total time from last waypoint
  const totalTime = waypointsWithTime.length > 0 
    ? waypointsWithTime[waypointsWithTime.length - 1].totalTime 
    : 0
  
  return {
    ...geometry,
    waypoints: waypointsWithTime,
    metadata: {
      ...geometry.metadata,
      totalTime
    }
  }
}

/**
 * Recalculate waypoint times based on updated settings
 * @param {Array} waypoints - Array of waypoints
 * @param {Object} settings - User speed settings
 * @returns {Array} Updated waypoints with recalculated times
 */
export const recalculateWaypoints = recalculateWaypointTimes

/**
 * Recalculate geometric metrics for waypoints
 * @param {Array} waypoints - Array of waypoints
 * @returns {Array} Updated waypoints with recalculated geometry
 */
export { recalculateWaypointGeometry }

/**
 * Format time utilities
 */
export {
  formatTimeHoursMinutes,
  formatTimeHoursMinutesForMin,
  formatTotalTimeWithPercentage
}
