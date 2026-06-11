import {
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_ACTIVITY_MODE,
  DEFAULT_ACTIVITY_MODES,
  DEFAULT_APP_SETTINGS,
  DEFAULT_COLUMN_VISIBILITY,
  DEFAULT_ROUTE_SETTINGS,
  DEFAULT_ROUTE_VIEW_VISIBILITY,
  DEFAULT_TRACK_PROCESSING,
} from './constants.js'

export {
  DEFAULT_ACTIVITY_MODE,
  DEFAULT_ACTIVITY_MODES,
  DEFAULT_APP_SETTINGS,
  DEFAULT_COLUMN_VISIBILITY,
  DEFAULT_ROUTE_SETTINGS,
  DEFAULT_ROUTE_VIEW_VISIBILITY,
} from './constants.js'

export function getColumnVisibility(settings) {
  return {
    ...DEFAULT_COLUMN_VISIBILITY,
    ...(settings?.columnVisibility ?? {}),
  }
}

export function getRouteViewVisibility(settings) {
  return {
    ...DEFAULT_ROUTE_VIEW_VISIBILITY,
    ...(settings?.routeViewVisibility ?? {}),
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
    routeViewVisibility: { ...DEFAULT_ROUTE_VIEW_VISIBILITY },
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
  const saved = localStorage.getItem(APP_SETTINGS_STORAGE_KEY)
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
