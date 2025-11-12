/**
 * Utilities for computing movement times and formatting time strings.
 */

function validatePositiveNumber(value, fallback) {
  if (!isFinite(value) || value <= 0) {
    return fallback
  }
  return value
}

/**
 * Calculate segment time using t = d/v (pure movement time only)
 * @param {number} distance - Segment distance in km
 * @param {number} elevationGain - Elevation gain in meters
 * @param {number} elevationLoss - Elevation loss in meters
 * @param {Object} settings - User speed settings with speeds in m/h
 * @returns {number} Time in minutes
 */
export function calculateSegmentTime(distance, elevationGain, elevationLoss, settings) {
  const ascentSpeed = validatePositiveNumber(settings?.ascentSpeed, 300)
  const descentSpeed = validatePositiveNumber(settings?.descentSpeed, 500)
  const flatSpeed = validatePositiveNumber(settings?.flatSpeed, 4000)

  const validDistance = isFinite(distance) ? Math.max(0, distance) : 0
  const validElevationGain = isFinite(elevationGain) ? Math.max(0, elevationGain) : 0
  const validElevationLoss = isFinite(elevationLoss) ? Math.max(0, elevationLoss) : 0

  const distanceMeters = validDistance * 1000
  let totalHours = 0

  if (distanceMeters > 0) {
    totalHours += distanceMeters / flatSpeed
  }
  if (validElevationGain > 0) {
    totalHours += validElevationGain / ascentSpeed
  }
  if (validElevationLoss > 0) {
    totalHours += validElevationLoss / descentSpeed
  }

  return totalHours * 60
}

/**
 * Calculate arrival time for a waypoint based on start time and elapsed minutes.
 * @param {string} startTime - Start time in HH:mm format
 * @param {number} elapsedMinutes - Elapsed minutes
 * @returns {string} Formatted arrival time in HH:mm format
 */
export function calculateArrivalTime(startTime, elapsedMinutes) {
  if (!startTime || typeof startTime !== 'string') {
    startTime = '08:00'
  }

  const [startHours, startMinutes] = startTime.split(':').map((part) => parseInt(part, 10))
  const validStartHours = isFinite(startHours) ? startHours : 8
  const validStartMinutes = isFinite(startMinutes) ? startMinutes : 0
  const baseDate = new Date(2000, 0, 1, validStartHours, validStartMinutes, 0, 0)
  const totalMinutes = isFinite(elapsedMinutes) ? elapsedMinutes : 0
  const arrivalDate = new Date(baseDate.getTime() + totalMinutes * 60000)
  const arrivalHours = arrivalDate.getHours().toString().padStart(2, '0')
  const arrivalMinutes = arrivalDate.getMinutes().toString().padStart(2, '0')
  return `${arrivalHours}:${arrivalMinutes}`
}

export function formatTimeHoursMinutes(minutes) {
  if (!isFinite(minutes) || minutes <= 0) {
    return '00h00'
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = Math.round(minutes % 60)
  return `${String(hours).padStart(2, '0')}h${String(remainingMinutes).padStart(2, '0')}`
}

export function formatTimeHoursMinutesForMin(minutes) {
  if (!isFinite(minutes) || minutes <= 0) {
    return '00:00'
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = Math.round(minutes % 60)
  return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`
}

export function formatTotalTimeWithPercentage(currentTime, routeTotalTime) {
  if (!isFinite(routeTotalTime) || routeTotalTime <= 0) {
    return formatTimeHoursMinutes(currentTime)
  }

  const percentage = (currentTime / routeTotalTime) * 100
  return `${formatTimeHoursMinutes(currentTime)} (${percentage.toFixed(0)}%)`
}

/**
 * Recalculate waypoint times based on updated settings or waypoint data.
 * @param {Array} waypoints - Array of waypoints
 * @param {Object} settings - User speed settings
 * @returns {Array} Updated waypoints
 */
export function recalculateWaypoints(waypoints, settings) {
  let totalTime = 0

  const updatedWaypoints = waypoints.map((waypoint, index) => {
    let segmentTime = 0

    if (index > 0) {
      segmentTime = calculateSegmentTime(
        waypoint.segmentDistance,
        waypoint.segmentAscent,
        waypoint.segmentDescent,
        settings
      )

      const segmentWithAdaptations =
        segmentTime * (1 + (waypoint.terrainDifficultyPenalty || 0)) + (waypoint.stopDuration || 0)
      totalTime += segmentWithAdaptations
    }

    return {
      ...waypoint,
      segmentTime,
      totalTime,
      timeTillArrival: totalTime,
      hour: calculateArrivalTime(settings?.startTime || '08:00', totalTime)
    }
  })

  return updatedWaypoints
}

export default {
  calculateSegmentTime,
  calculateArrivalTime,
  formatTimeHoursMinutes,
  formatTimeHoursMinutesForMin,
  formatTotalTimeWithPercentage,
  recalculateWaypoints
}

