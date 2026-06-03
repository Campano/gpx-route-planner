/**
 * Utilities for computing movement times and formatting time strings.
 */

import { getTrackPathBetweenWaypoints } from './gpxParser.js'
import { calculateDistance } from './trackProcessingUtils.js'

/** @typedef {'additive' | 'activity_blend'} TimeCalculationMethod */

export const TIME_CALCULATION_METHODS = {
  ADDITIVE: 'additive',
  ACTIVITY_BLEND: 'activity_blend',
}

export const DEFAULT_TIME_CALCULATION_METHOD = TIME_CALCULATION_METHODS.ACTIVITY_BLEND
export const DEFAULT_DOWNHILL_FACTOR = 2 / 3

function validatePositiveNumber(value, fallback) {
  if (!isFinite(value) || value <= 0) {
    return fallback
  }
  return value
}

function flatTimeHours(distanceKm, flatSpeedMh) {
  const distanceMeters = (isFinite(distanceKm) ? Math.max(0, distanceKm) : 0) * 1000
  if (distanceMeters <= 0) return 0
  return distanceMeters / flatSpeedMh
}

function verticalTimeHours(elevationGain, elevationLoss, ascentSpeed, descentSpeed) {
  const gain = isFinite(elevationGain) ? Math.max(0, elevationGain) : 0
  const loss = isFinite(elevationLoss) ? Math.max(0, elevationLoss) : 0

  if (gain <= 0 && loss <= 0) return { hours: 0, isDownhillDominant: false }

  if (gain >= loss) {
    return { hours: gain / ascentSpeed, isDownhillDominant: false }
  }

  return { hours: loss / descentSpeed, isDownhillDominant: loss > 0 }
}

/**
 * Additive component rates: horizontal and vertical time are summed (Naismith-style decomposition).
 */
export function calculateSegmentTimeAdditive(distance, elevationGain, elevationLoss, settings) {
  const ascentSpeed = validatePositiveNumber(settings?.ascentSpeed, 300)
  const descentSpeed = validatePositiveNumber(settings?.descentSpeed, 500)
  const flatSpeed = validatePositiveNumber(settings?.flatSpeed, 4000)

  let totalHours = flatTimeHours(distance, flatSpeed)
  const gain = isFinite(elevationGain) ? Math.max(0, elevationGain) : 0
  const loss = isFinite(elevationLoss) ? Math.max(0, elevationLoss) : 0
  if (gain > 0) totalHours += gain / ascentSpeed
  if (loss > 0) totalHours += loss / descentSpeed

  return totalHours * 60
}

/**
 * Sum blended activity time over each step along a path (Timewise-style; matches rolling terrain).
 */
export function calculateActivityBlendTimeFromPathPoints(pathPoints, settings) {
  if (!Array.isArray(pathPoints) || pathPoints.length < 2) {
    return 0
  }

  const flatSpeedMh = validatePositiveNumber(settings?.flatSpeed, 4000)
  const ascentSpeedMh = validatePositiveNumber(settings?.ascentSpeed, 300)
  const descentSpeedMh = validatePositiveNumber(settings?.descentSpeed, 500)
  const downhillFactor = validatePositiveNumber(settings?.downhillFactor, DEFAULT_DOWNHILL_FACTOR)

  let totalHours = 0

  for (let i = 1; i < pathPoints.length; i++) {
    const previousPoint = pathPoints[i - 1]
    const currentPoint = pathPoints[i]

    if (
      !isFinite(previousPoint?.latitude) ||
      !isFinite(previousPoint?.longitude) ||
      !isFinite(currentPoint?.latitude) ||
      !isFinite(currentPoint?.longitude)
    ) {
      continue
    }

    const distKm = calculateDistance(
      previousPoint.latitude,
      previousPoint.longitude,
      currentPoint.latitude,
      currentPoint.longitude,
    )

    const dEle = (currentPoint.elevation ?? 0) - (previousPoint.elevation ?? 0)
    const ascentM = dEle > 0 ? dEle : 0
    const descentM = dEle < 0 ? -dEle : 0

    const h = flatTimeHours(distKm, flatSpeedMh)
    let v = 0
    if (ascentM > 0) {
      v = ascentM / ascentSpeedMh
    } else if (descentM > 0) {
      v = descentM / descentSpeedMh
    }

    let segHours = Math.max(h, v) + 0.5 * Math.min(h, v)
    if (descentM > 0 && descentM >= ascentM) {
      segHours *= downhillFactor
    }

    totalHours += segHours
  }

  return totalHours * 60
}

/**
 * Blended activity time on aggregated leg totals (fallback when no track path is available).
 */
export function calculateSegmentTimeActivityBlendAggregated(
  distance,
  elevationGain,
  elevationLoss,
  settings,
) {
  const ascentSpeed = validatePositiveNumber(settings?.ascentSpeed, 300)
  const descentSpeed = validatePositiveNumber(settings?.descentSpeed, 500)
  const flatSpeed = validatePositiveNumber(settings?.flatSpeed, 4000)
  const downhillFactor = validatePositiveNumber(settings?.downhillFactor, DEFAULT_DOWNHILL_FACTOR)

  const flatHours = flatTimeHours(distance, flatSpeed)
  const { hours: verticalHours, isDownhillDominant } = verticalTimeHours(
    elevationGain,
    elevationLoss,
    ascentSpeed,
    descentSpeed,
  )

  let segmentHours = Math.max(flatHours, verticalHours) + 0.5 * Math.min(flatHours, verticalHours)
  if (isDownhillDominant) {
    segmentHours *= downhillFactor
  }

  return segmentHours * 60
}

/**
 * Blended activity time: per-step sum along track when pathPoints provided, else aggregated leg formula.
 */
export function calculateSegmentTimeActivityBlend(
  distance,
  elevationGain,
  elevationLoss,
  settings,
  pathPoints = null,
) {
  if (Array.isArray(pathPoints) && pathPoints.length >= 2) {
    return calculateActivityBlendTimeFromPathPoints(pathPoints, settings)
  }
  return calculateSegmentTimeActivityBlendAggregated(distance, elevationGain, elevationLoss, settings)
}

/**
 * Calculate segment movement time in minutes.
 * @param {number} distance - Segment distance in km
 * @param {number} elevationGain - Elevation gain in meters
 * @param {number} elevationLoss - Elevation loss in meters
 * @param {Object} settings - Route settings (speeds in m/h, timeCalculationMethod, downhillFactor)
 * @param {Array<{latitude, longitude, elevation?}>|null} [pathPoints] - Optional track path for blended mode
 * @returns {number} Time in minutes
 */
export function calculateSegmentTime(
  distance,
  elevationGain,
  elevationLoss,
  settings,
  pathPoints = null,
) {
  const method = settings?.timeCalculationMethod ?? DEFAULT_TIME_CALCULATION_METHOD
  if (method === TIME_CALCULATION_METHODS.ACTIVITY_BLEND) {
    return calculateSegmentTimeActivityBlend(
      distance,
      elevationGain,
      elevationLoss,
      settings,
      pathPoints,
    )
  }
  return calculateSegmentTimeAdditive(distance, elevationGain, elevationLoss, settings)
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
 * @param {{ processedTrackPoints?: Array<{latitude, longitude, elevation?}> }} [options]
 * @returns {Array} Updated waypoints
 */
export function recalculateWaypoints(waypoints, settings, options = {}) {
  let totalTime = 0
  const startTime = settings?.startTime || '08:00'
  const processedTrackPoints = options.processedTrackPoints ?? null
  const useTrackBlend =
    (settings?.timeCalculationMethod ?? DEFAULT_TIME_CALCULATION_METHOD) ===
      TIME_CALCULATION_METHODS.ACTIVITY_BLEND &&
    Array.isArray(processedTrackPoints) &&
    processedTrackPoints.length > 0

  return waypoints.map((waypoint, index) => {
    let segmentTime = 0

    if (index > 0) {
      const previousWaypoint = waypoints[index - 1]
      const pathPoints = useTrackBlend
        ? getTrackPathBetweenWaypoints(
            processedTrackPoints,
            previousWaypoint.latitude,
            previousWaypoint.longitude,
            waypoint.latitude,
            waypoint.longitude,
          )
        : null

      segmentTime = calculateSegmentTime(
        waypoint.segmentDistance,
        waypoint.segmentAscent,
        waypoint.segmentDescent,
        settings,
        pathPoints,
      )
      totalTime += segmentTime * (1 + (waypoint.terrainDifficultyPenalty || 0))
    }

    const arrivalAtWaypoint = totalTime

    const rests = (waypoint.rests ?? []).map((rest) => {
      const durationMinutes = Math.max(0, rest.durationMinutes || 0)
      const arrivalAtRest = totalTime
      totalTime += durationMinutes
      return {
        ...rest,
        durationMinutes,
        segmentTime: durationMinutes,
        arrivalTimeMinutes: arrivalAtRest,
        totalTime,
        hour: calculateArrivalTime(startTime, arrivalAtRest),
        departureHour: calculateArrivalTime(startTime, totalTime),
      }
    })

    return {
      ...waypoint,
      rests,
      segmentTime,
      totalTime: arrivalAtWaypoint,
      timeTillArrival: arrivalAtWaypoint,
      hour: calculateArrivalTime(startTime, arrivalAtWaypoint),
    }
  })
}

export default {
  TIME_CALCULATION_METHODS,
  calculateSegmentTime,
  calculateSegmentTimeAdditive,
  calculateSegmentTimeActivityBlend,
  calculateSegmentTimeActivityBlendAggregated,
  calculateActivityBlendTimeFromPathPoints,
  calculateArrivalTime,
  formatTimeHoursMinutes,
  formatTimeHoursMinutesForMin,
  formatTotalTimeWithPercentage,
  recalculateWaypoints,
}
