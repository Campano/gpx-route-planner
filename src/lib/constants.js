/**
 * Application defaults and domain constants.
 */

// --- Proximity / GPX parsing (meters) ---

/** Max distance to treat two coordinates as the same checkpoint. */
export const PROXIMITY_THRESHOLD_M = 25

/** High-precision tolerance for start/end vs track point equality. */
export const TRACK_POINT_PRECISION_TOLERANCE_M = 0.1

/** Max waypoints to sample when a GPX file has no explicit waypoints. */
export const MAX_SAMPLED_WAYPOINTS = 20

// --- Track preprocessing ---

export const DEFAULT_TRACK_PROCESSING = {
  resampleSpacingM: 3,
  smoothWindowM: 15,
  elevationDeadbandM: 2,
}

// --- Time calculation ---

/** @typedef {'additive' | 'activity_blend'} TimeCalculationMethod */

export const TIME_CALCULATION_METHODS = {
  ADDITIVE: 'additive',
  ACTIVITY_BLEND: 'activity_blend',
}

export const DEFAULT_TIME_CALCULATION_METHOD = TIME_CALCULATION_METHODS.ACTIVITY_BLEND
export const DEFAULT_DOWNHILL_FACTOR = 2 / 3

// --- Activity modes (speeds in m/h) ---

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

// --- Route & app defaults ---

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

export const APP_SETTINGS_STORAGE_KEY = 'mountainSettings'

/** Optional table columns (all visible by default). */
export const DEFAULT_COLUMN_VISIBILITY = {
  destinationCoords: true,
  routeDistance: true,
  totalTime: true,
  progression: true,
}

/** Map and elevation graph visibility (both visible by default). */
export const DEFAULT_ROUTE_VIEW_VISIBILITY = {
  map: true,
  elevationGraph: true,
}

// --- Geo ---

export const EARTH_RADIUS_METERS = 6371000
export const DEG_TO_RAD = Math.PI / 180
