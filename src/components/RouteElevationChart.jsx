import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { buildElevationProfile } from '../lib/elevationProfile.js'

function niceStep(range, targetTicks = 5) {
  if (!isFinite(range) || range <= 0) return 1
  const rough = range / targetTicks
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  let niceNormalized = 10
  if (normalized <= 1) niceNormalized = 1
  else if (normalized <= 2) niceNormalized = 2
  else if (normalized <= 5) niceNormalized = 5
  return niceNormalized * magnitude
}

function niceAxis(min, max, targetTicks = 5, minPaddingRatio = 0.05) {
  const span = Math.max(max - min, 1)
  const padding = Math.max(span * minPaddingRatio, span * 0.02)
  const paddedMin = min - padding
  const paddedMax = max + padding
  const step = niceStep(paddedMax - paddedMin, targetTicks)
  const domainMin = Math.floor(paddedMin / step) * step
  const domainMax = Math.ceil(paddedMax / step) * step
  const ticks = []
  for (let value = domainMin; value <= domainMax + step * 0.001; value += step) {
    ticks.push(Number(value.toFixed(6)))
  }
  return { domain: [domainMin, domainMax], ticks, step }
}

function niceDistanceAxis(maxDistance, targetTicks = 6) {
  const max = Math.max(maxDistance, 0.001)
  const step = niceStep(max, targetTicks)
  const domainMax = Math.ceil(max / step) * step
  const ticks = []
  for (let value = 0; value <= domainMax + step * 0.001; value += step) {
    ticks.push(Number(value.toFixed(6)))
  }
  return { domain: [0, domainMax], ticks, step }
}

function formatDistanceTick(value, step) {
  if (step >= 1) return Math.round(value).toString()
  if (step >= 0.1) return value.toFixed(1)
  return value.toFixed(2)
}

function markerColor(marker) {
  if (marker.isStartPoint) return '#16a34a'
  if (marker.isEndPoint) return '#dc2626'
  if (marker.isDecisionPoint) return '#ea580c'
  return '#2563eb'
}

function ElevationTooltip({ active, payload, distanceUnit }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null

  return (
    <div className="rounded-md border border-border bg-popover px-2 py-1 text-[10px] shadow-md">
      <div>
        {point.distanceKm.toFixed(2)} {distanceUnit}
      </div>
      <div className="font-medium">{Math.round(point.elevation)} m</div>
    </div>
  )
}

const RouteElevationChart = ({ route, getWaypointDisplayName, distanceUnit = 'km', elevationLabel = 'm' }) => {
  const profileData = useMemo(
    () => buildElevationProfile(route, getWaypointDisplayName),
    [route, getWaypointDisplayName],
  )

  if (!profileData) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
        No elevation data available for this route.
      </div>
    )
  }

  const { profile, waypointMarkers } = profileData
  const elevations = profile.map((p) => p.elevation)
  const distances = profile.map((p) => p.distanceKm)
  const minElevation = Math.min(...elevations)
  const maxElevation = Math.max(...elevations)
  const maxDistance = Math.max(...distances)

  const yAxis = niceAxis(minElevation, maxElevation, 5, 0.08)
  const xAxis = niceDistanceAxis(maxDistance, 6)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={profile}
        margin={{ top: 36, right: 16, left: 8, bottom: 20 }}
      >
        <defs>
          <linearGradient id="elevationFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke="var(--border)"
          strokeOpacity={0.85}
          strokeDasharray="4 4"
          vertical
          horizontal
        />
        <XAxis
          dataKey="distanceKm"
          type="number"
          domain={xAxis.domain}
          ticks={xAxis.ticks}
          allowDecimals={xAxis.step < 1}
          tickFormatter={(value) => formatDistanceTick(value, xAxis.step)}
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={{ stroke: 'var(--border)' }}
          label={{
            value: distanceUnit,
            position: 'insideBottomRight',
            offset: -4,
            fontSize: 10,
            fill: 'var(--muted-foreground)',
          }}
        />
        <YAxis
          domain={yAxis.domain}
          ticks={yAxis.ticks}
          allowDecimals={false}
          tickFormatter={(value) => Math.round(value).toString()}
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          width={40}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={{ stroke: 'var(--border)' }}
          label={{
            value: elevationLabel,
            angle: -90,
            position: 'insideLeft',
            fontSize: 10,
            fill: 'var(--muted-foreground)',
          }}
        />
        <Tooltip content={<ElevationTooltip distanceUnit={distanceUnit} />} />
        <Area
          type="monotone"
          dataKey="elevation"
          stroke="#2563eb"
          strokeWidth={2}
          fill="url(#elevationFill)"
          isAnimationActive={false}
          dot={false}
          activeDot={{ r: 3 }}
        />
        {waypointMarkers.map((marker) => (
          <ReferenceDot
            key={marker.id}
            x={marker.distanceKm}
            y={marker.elevation}
            r={4}
            fill={markerColor(marker)}
            stroke="#fff"
            strokeWidth={1.5}
            isFront
          >
            <Label
              value={marker.name}
              position="top"
              angle={-35}
              offset={12}
              fontSize={9}
              fill="currentColor"
              className="fill-foreground"
            />
          </ReferenceDot>
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default RouteElevationChart
