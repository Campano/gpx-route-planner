import { useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMapEvent, useMap } from 'react-leaflet'
import L from 'leaflet'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { getRouteTrackPoints } from '../lib/elevationProfile.js'

const PIN_WIDTH = 25
const PIN_HEIGHT = 41
const LABEL_GAP_PX = 6

/** Pin tip at lat/lng; tooltip anchor at top center of icon (Leaflet default anchor is off-center). */
const waypointMapIcon = new L.Icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [PIN_WIDTH, PIN_HEIGHT],
  iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
  popupAnchor: [0, -PIN_HEIGHT],
  tooltipAnchor: [0, -PIN_HEIGHT],
})

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [PIN_WIDTH, PIN_HEIGHT],
  iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
  tooltipAnchor: [0, -PIN_HEIGHT],
})

L.Icon.Default.imagePath = ''

const FIT_BOUNDS_PADDING = [24, 24]
const FIT_BOUNDS_MAX_ZOOM = 17

function fitMapToTrack(map, bounds, positions) {
  if (bounds && positions.length >= 2) {
    map.fitBounds(bounds, { padding: FIT_BOUNDS_PADDING, maxZoom: FIT_BOUNDS_MAX_ZOOM })
  } else if (positions.length === 1) {
    map.setView(positions[0], 14)
  }
}

const MapClickHandler = ({ onAddWaypoint }) => {
  useMapEvent('click', (event) => {
    if (!onAddWaypoint) return
    onAddWaypoint({ lat: event.latlng.lat, lng: event.latlng.lng })
  })
  return null
}

// Component to handle map resize when container size changes
const MapResizeHandler = ({ panelState }) => {
  const map = useMap()
  
  // Handle panel state changes (opening/closing side panels)
  useEffect(() => {
    let timeoutId = null
    
    // Use requestAnimationFrame for smoother updates, then a small delay for DOM to settle
    const frameId = requestAnimationFrame(() => {
      timeoutId = setTimeout(() => {
        map.invalidateSize()
      }, 100)
    })
    
    return () => {
      cancelAnimationFrame(frameId)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [map, panelState])
  
  // Also handle window resize events
  useEffect(() => {
    let resizeTimeout = null
    
    const handleResize = () => {
      // Clear existing timeout to debounce resize events
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      
      // Small delay to debounce resize events
      resizeTimeout = setTimeout(() => {
        map.invalidateSize()
      }, 150)
    }
    
    window.addEventListener('resize', handleResize)
    
    // Initial invalidate to ensure tiles load correctly on mount
    map.invalidateSize()
    
    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
    }
  }, [map])
  
  return null
}

const MapPrintHandler = () => {
  const map = useMap()

  useEffect(() => {
    const handleBeforePrint = () => {
      map.invalidateSize()
      setTimeout(() => map.invalidateSize(), 150)
    }

    window.addEventListener('beforeprint', handleBeforePrint)
    return () => window.removeEventListener('beforeprint', handleBeforePrint)
  }, [map])

  return null
}

const FitTrackControl = ({ bounds, positions, title }) => {
  const map = useMap()

  useEffect(() => {
    const control = L.control({ position: 'topleft' })

    control.onAdd = () => {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-fit-track')
      const button = L.DomUtil.create('button', 'leaflet-control-fit-track-button', container)
      button.type = 'button'
      button.title = title
      button.setAttribute('aria-label', title)
      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 2v4"/>
          <path d="M12 18v4"/>
          <path d="M2 12h4"/>
          <path d="M18 12h4"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      `

      L.DomEvent.disableClickPropagation(button)
      L.DomEvent.on(button, 'click', (event) => {
        L.DomEvent.preventDefault(event)
        L.DomEvent.stopPropagation(event)
        fitMapToTrack(map, bounds, positions)
      })

      return container
    }

    control.addTo(map)
    return () => {
      control.remove()
    }
  }, [map, bounds, positions, title])

  return null
}

const RouteMap = ({ route, onAddWaypoint, onRemoveWaypoint, getWaypointDisplayName, panelState, recenterTitle }) => {
  const waypoints = route?.waypoints ?? []
  const trackPoints = useMemo(() => getRouteTrackPoints(route) ?? [], [route])

  const positions = useMemo(() => {
    if (trackPoints.length > 1) {
      return trackPoints
        .filter((point) => typeof point.latitude === 'number' && typeof point.longitude === 'number')
        .map((point) => [point.latitude, point.longitude])
    }

    return waypoints
      .filter((wp) => typeof wp.latitude === 'number' && typeof wp.longitude === 'number')
      .map((wp) => [wp.latitude, wp.longitude])
  }, [trackPoints, waypoints])

  const bounds = useMemo(() => {
    if (positions.length < 2) return null
    return L.latLngBounds(positions)
  }, [positions])

  if (positions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No geographic data available for this route.
      </div>
    )
  }

  return (
    <MapContainer
      key={route.id}
      bounds={bounds ?? undefined}
      center={bounds ? undefined : positions[0]}
      zoom={13}
      scrollWheelZoom
      style={{ height: '100%', width: '100%', zIndex: 0 }}
    >
      <TileLayer
        attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://srtm.csi.cgiar.org/">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
        url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
        maxZoom={17}
      />

      <MapClickHandler onAddWaypoint={onAddWaypoint} />
      <MapResizeHandler panelState={panelState} />
      <MapPrintHandler />
      <FitTrackControl bounds={bounds} positions={positions} title={recenterTitle} />

      {positions.length > 1 && (
        <Polyline 
          positions={positions} 
          color="#2563eb" 
          weight={4} 
          opacity={0.8}
          eventHandlers={{
            add: (e) => {
              // Bind tooltip once when polyline is added to map
              const layer = e.target;
              layer.bindTooltip('Click to add waypoint here', {
                permanent: false,
                direction: 'top',
                offset: [0, -10],
                className: 'leaflet-tooltip-custom',
                sticky: true
              });
            },
            mouseover: (e) => {
              const layer = e.target;
              layer.setStyle({
                weight: 6,
                opacity: 1
              });
              // Show tooltip at mouse position
              layer.openTooltip(e.latlng);
            },
            mouseout: (e) => {
              const layer = e.target;
              layer.setStyle({
                weight: 4,
                opacity: 0.8
              });
              layer.closeTooltip();
            }
          }}
        />
      )}

      {waypoints.map((wp) => {
        if (typeof wp.latitude !== 'number' || typeof wp.longitude !== 'number') {
          return null
        }

        const canRemove = !wp.isStartPoint && !wp.isEndPoint

        const displayName = getWaypointDisplayName
          ? getWaypointDisplayName(wp)
          : wp.name || 'Waypoint'

        return (
          <Marker
            key={wp.id}
            position={[wp.latitude, wp.longitude]}
            icon={waypointMapIcon}
            eventHandlers={
              onRemoveWaypoint && canRemove
                ? {
                    click: () => onRemoveWaypoint(wp.id)
                  }
                : undefined
            }
          >
            <Tooltip
              permanent
              direction="top"
              offset={[0, -LABEL_GAP_PX]}
              className="waypoint-map-label"
              interactive={false}
            >
              {displayName}
            </Tooltip>
          </Marker>
        )
      })}
    </MapContainer>
  )
}

export default RouteMap

