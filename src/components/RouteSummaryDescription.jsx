import { DEFAULT_ACTIVITY_MODE, getEffectiveRouteSettings } from '../lib/routeDefaults.js'
import { formatTimeHoursMinutes } from '../lib/calculationService.js'
import { getRouteEndTime } from '../lib/routeTableRows.js'

function getEndingTime(startTime, totalMinutesFromMidnight) {
  const endingHours = Math.floor(totalMinutesFromMidnight / 60) % 24
  const endingMinutes = Math.round(totalMinutesFromMidnight % 60)
  return `${endingHours.toString().padStart(2, '0')}:${endingMinutes.toString().padStart(2, '0')}`
}

function getUtmZones(waypoints) {
  const zones = [
    ...new Set(
      waypoints
        .map((wp) => {
          if (!wp.utm) return null
          const match = wp.utm.match(/Zone (\d+)([A-Z])/)
          return match ? `UTM ${match[1]}${match[2]}` : null
        })
        .filter(Boolean),
    ),
  ]
  return zones.length > 0 ? zones.join(', ') : 'N/A'
}

const RouteSummaryDescription = ({ route, t, className = '' }) => {
  const waypoints = route?.waypoints ?? []
  if (waypoints.length === 0) return null

  const settings = getEffectiveRouteSettings(route)
  const lastWaypoint = waypoints[waypoints.length - 1]
  const routeEndTime = getRouteEndTime(waypoints)
  const totalWithSafety = routeEndTime * (1 + (settings.safetyTimePercentage || 0) / 100)
  const startTime = settings.startTime || '08:00'
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const endingTime = getEndingTime(
    startTime,
    startHours * 60 + startMinutes + Math.round(totalWithSafety),
  )

  const totalDistance = route.metadata?.totalDistance ?? lastWaypoint.totalDistance ?? 0
  const totalAscent = route.metadata?.totalAscent ?? lastWaypoint.totalAscent ?? 0
  const totalDescent = route.metadata?.totalDescent ?? lastWaypoint.totalDescent ?? 0
  const maxElevation =
    route.metadata?.maxElevation ??
    Math.max(...waypoints.map((wp) => wp.elevation || 0), 0)

  const activityMode = settings.activityMode || DEFAULT_ACTIVITY_MODE

  return (
    <div className={`text-xs space-y-1 ${className}`.trim()}>
      <div className="font-medium">
        {waypoints.length} waypoints • {totalDistance.toFixed(2)} km • +{totalAscent.toFixed(0)}m • -
        {totalDescent.toFixed(0)}m • {maxElevation.toFixed(0)}m max
      </div>
      <div className="text-muted-foreground">
        {formatTimeHoursMinutes(totalWithSafety)} • {startTime}-{endingTime} • {getUtmZones(waypoints)} •{' '}
        {t(activityMode)} (
        <span className="text-xs">
          ↑{settings.ascentSpeed} ↓{settings.descentSpeed} →{settings.flatSpeed} m/h
        </span>
        )
      </div>
    </div>
  )
}

export default RouteSummaryDescription
