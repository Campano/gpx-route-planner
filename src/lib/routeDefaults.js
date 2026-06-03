import { DEFAULT_TRACK_PROCESSING } from './trackProcessing.js'
import {
  DEFAULT_DOWNHILL_FACTOR,
  DEFAULT_TIME_CALCULATION_METHOD,
} from './timeCalculator.js'

/** Default speeds per activity mode (m/h) — used for new routes and mode presets */
export const DEFAULT_ACTIVITY_MODES = {
  hiking: {
    ascentSpeed: 300,
    descentSpeed: 500,
    flatSpeed: 4000,
  },
  snowshoes: {
    ascentSpeed: 250,
    descentSpeed: 400,
    flatSpeed: 3200,
  },
  skiTouring: {
    ascentSpeed: 400,
    descentSpeed: 600,
    flatSpeed: 4000,
  },
}

export const DEFAULT_ACTIVITY_MODE = 'hiking'

export const DEFAULT_ROUTE_SETTINGS = {
  activityMode: DEFAULT_ACTIVITY_MODE,
  startTime: '08:00',
  distanceCalculationMethod: 'track',
  safetyTimePercentage: 20,
  timeCalculationMethod: DEFAULT_TIME_CALCULATION_METHOD,
  downhillFactor: DEFAULT_DOWNHILL_FACTOR,
  ...DEFAULT_TRACK_PROCESSING,
  ...DEFAULT_ACTIVITY_MODES[DEFAULT_ACTIVITY_MODE],
}

export const DEFAULT_APP_SETTINGS = {
  suppressWaypointModificationWarning: false,
}

/** Optional table columns (all visible by default). */
export const DEFAULT_COLUMN_VISIBILITY = {
  destinationCoords: true,
  routeDistance: true,
  totalTime: true,
  progression: true,
}

export function getColumnVisibility(settings) {
  return {
    ...DEFAULT_COLUMN_VISIBILITY,
    ...(settings?.columnVisibility ?? {}),
  }
}

export function getModeSpeeds(activityMode) {
  return DEFAULT_ACTIVITY_MODES[activityMode] ?? DEFAULT_ACTIVITY_MODES[DEFAULT_ACTIVITY_MODE]
}

/** Settings snapshot used when creating a new route from a GPX upload */
export function createDefaultRouteSettings(activityMode = DEFAULT_ACTIVITY_MODE) {
  return {
    activityMode,
    startTime: DEFAULT_ROUTE_SETTINGS.startTime,
    distanceCalculationMethod: DEFAULT_ROUTE_SETTINGS.distanceCalculationMethod,
    safetyTimePercentage: DEFAULT_ROUTE_SETTINGS.safetyTimePercentage,
    timeCalculationMethod: DEFAULT_ROUTE_SETTINGS.timeCalculationMethod,
    downhillFactor: DEFAULT_ROUTE_SETTINGS.downhillFactor,
    ...DEFAULT_TRACK_PROCESSING,
    ...getModeSpeeds(activityMode),
    columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
  }
}

/** Route settings for calculations; merges defaults for legacy or partial settings */
export function getEffectiveRouteSettings(route) {
  const mode = route?.settings?.activityMode ?? DEFAULT_ACTIVITY_MODE
  return {
    ...createDefaultRouteSettings(mode),
    ...(route?.settings ?? {}),
  }
}

export function loadAppSettings() {
  const saved = localStorage.getItem('mountainSettings')
  if (!saved) {
    return { ...DEFAULT_APP_SETTINGS }
  }
  try {
    const parsed = JSON.parse(saved)
    return {
      suppressWaypointModificationWarning: Boolean(parsed.suppressWaypointModificationWarning),
    }
  } catch {
    return { ...DEFAULT_APP_SETTINGS }
  }
}
