/**
 * Data models for the Mountain Route Planner application
 */

/**
 * @typedef {Object} Route
 * @property {string} id - Unique identifier for the route
 * @property {string} name - User-defined route name
 * @property {any} gpxData - Raw parsed GPX data from gpxjs
 * @property {Waypoint[]} waypoints - Array of waypoints in the route
 * @property {number} createdAt - Timestamp for sorting/management
 */

/**
 * @typedef {Object} Waypoint
 * @property {string} id - Unique identifier for the waypoint
 * @property {string} name - Waypoint name
 * @property {boolean} isDecisionPoint - Y/N for decision point
 * @property {number} latitude - Latitude coordinate
 * @property {number} longitude - Longitude coordinate
 * @property {number} elevation - Elevation at waypoint in meters
 * @property {number} segmentDistance - Distance from previous waypoint in km
 * @property {number} segmentAscent - Elevation gain from previous waypoint in meters
 * @property {number} segmentDescent - Elevation loss from previous waypoint in meters
 * @property {number} totalDistance - Cumulative distance from route start in km
 * @property {number} totalAscent - Cumulative elevation gain from route start in meters
 * @property {number} totalDescent - Cumulative elevation loss from route start in meters
 * @property {number} terrainDifficultyPenalty - Percentage penalty for terrain difficulty (e.g., 0.1 for 10% slower)
 * @property {number} stopDuration - Duration of a stop at this waypoint in minutes
 * @property {number} segmentTime - Estimated time for this segment in minutes
 * @property {number} totalTime - Cumulative time from route start in minutes
 * @property {number} timeTillArrival - Time remaining until arrival at this waypoint in minutes
 * @property {string} hour - Estimated arrival hour at this waypoint (e.g., "HH:MM")
 * @property {string} comments - User comments
 */

/**
 * @typedef {Object} UserSettings
 * @property {number} ascentSpeed - Speed for ascending in km/h
 * @property {number} descentSpeed - Speed for descending in km/h
 * @property {number} flatSpeed - Speed for flat terrain in km/h
 * @property {string} startTime - Start time for the route (e.g., "08:00")
 */

export {}

