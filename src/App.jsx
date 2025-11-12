import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx'
import { Upload, Mountain, Settings, Settings2, FileText, Trash2, Download, EyeOff, FolderOpen, Edit3, AlertTriangle, HelpCircle, X, Globe, Plus, Footprints, Snowflake, Zap, Heart, FileSpreadsheet, Info, AlertCircle, Clock, MapPin, FileDown } from 'lucide-react'
import { parseGPXFile, recalculateWaypoints, recalculateWaypointGeometry, formatTimeHoursMinutes, formatTimeHoursMinutesForMin, formatTotalTimeWithPercentage } from './lib/calculationService.js'
import { exportRouteToPDF } from './lib/pdfExportService.js'
import { exportRouteToGPX, checkWaypointModifications } from './lib/gpxExportService.js'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.jsx'
import { Checkbox } from '@/components/ui/checkbox.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import GitHubCorner from './components/GitHubCorner.jsx'
import RouteMap from './components/RouteMap.jsx'
import packageJson from '../package.json'
import { translations, languages } from './lib/translations.js'
import { getWaypointDisplayName as buildWaypointDisplayName } from './lib/waypointUtils.js'
import 'leaflet/dist/leaflet.css'
import './App.css'

const EARTH_RADIUS_METERS = 6371000
const DEG_TO_RAD = Math.PI / 180

const toECEF = (latitude, longitude) => {
  const phi = latitude * DEG_TO_RAD
  const lambda = longitude * DEG_TO_RAD
  const cosPhi = Math.cos(phi)

  return {
    x: EARTH_RADIUS_METERS * cosPhi * Math.cos(lambda),
    y: EARTH_RADIUS_METERS * cosPhi * Math.sin(lambda),
    z: EARTH_RADIUS_METERS * Math.sin(phi)
  }
}

const subtractVectors = (a, b) => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z
})

const addVectors = (a, b) => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z
})

const scaleVector = (vector, scalar) => ({
  x: vector.x * scalar,
  y: vector.y * scalar,
  z: vector.z * scalar
})

const dotProduct = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z

const vectorLengthSquared = (vector) => dotProduct(vector, vector)

const distancePointToSegment = (point, segmentStart, segmentEnd) => {
  const segmentVector = subtractVectors(segmentEnd, segmentStart)
  const pointVector = subtractVectors(point, segmentStart)
  const segmentLengthSquared = vectorLengthSquared(segmentVector)

  if (segmentLengthSquared === 0) {
    const distanceVector = subtractVectors(point, segmentStart)
    return { distance: Math.sqrt(vectorLengthSquared(distanceVector)), ratio: 0 }
  }

  let t = dotProduct(pointVector, segmentVector) / segmentLengthSquared
  t = Math.max(0, Math.min(1, t))

  const projection = addVectors(segmentStart, scaleVector(segmentVector, t))
  const distanceVector = subtractVectors(point, projection)

  return { distance: Math.sqrt(vectorLengthSquared(distanceVector)), ratio: t }
}

const findNearestTrackPoint = (latitude, longitude, trackPoints) => {
  if (!Array.isArray(trackPoints) || trackPoints.length === 0) {
    return null
  }

  const target = toECEF(latitude, longitude)
  let bestPoint = null
  let bestDistance = Number.POSITIVE_INFINITY

  trackPoints.forEach((point) => {
    if (!isFinite(point.latitude) || !isFinite(point.longitude)) {
      return
    }
    const candidate = toECEF(point.latitude, point.longitude)
    const distanceVector = subtractVectors(target, candidate)
    const distance = Math.sqrt(vectorLengthSquared(distanceVector))
    if (distance < bestDistance) {
      bestDistance = distance
      bestPoint = point
    }
  })

  return bestPoint
}

const findInsertionDetails = (latitude, longitude, waypoints) => {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return {
      insertIndex: Math.max(waypoints.length - 1, 0),
      ratio: 0,
      previousWaypoint: waypoints[0] ?? null,
      nextWaypoint: waypoints[waypoints.length - 1] ?? null
    }
  }

  const target = toECEF(latitude, longitude)
  let bestDistance = Number.POSITIVE_INFINITY
  let bestInsertIndex = waypoints.length - 1
  let bestRatio = 0
  let previousWaypoint = waypoints[0]
  let nextWaypoint = waypoints[waypoints.length - 1]

  for (let index = 1; index < waypoints.length; index += 1) {
    const start = waypoints[index - 1]
    const end = waypoints[index]

    if (
      !isFinite(start.latitude) ||
      !isFinite(start.longitude) ||
      !isFinite(end.latitude) ||
      !isFinite(end.longitude)
    ) {
      continue
    }

    const startECEF = toECEF(start.latitude, start.longitude)
    const endECEF = toECEF(end.latitude, end.longitude)
    const { distance, ratio } = distancePointToSegment(target, startECEF, endECEF)

    if (distance < bestDistance) {
      bestDistance = distance
      bestInsertIndex = index
      bestRatio = ratio
      previousWaypoint = start
      nextWaypoint = end
    }
  }

  return {
    insertIndex: bestInsertIndex,
    ratio: bestRatio,
    previousWaypoint,
    nextWaypoint
  }
}

function App() {
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('mountainSettings')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.warn('Failed to parse saved settings, using defaults')
      }
    }
    return {
      activityMode: 'hiking', // 'hiking', 'snowshoes', 'skiTouring'
      activityModes: {
        hiking: {
      ascentSpeed: 300, // m/h (meters per hour)
          descentSpeed: 500, // m/h
          flatSpeed: 4000, // m/h (4 km/h = 4000 m/h)
        },
        snowshoes: {
          ascentSpeed: 300, // m/h
          descentSpeed: 500, // m/h
          flatSpeed: 4000, // m/h (4 km/h = 4000 m/h)
        },
        skiTouring: {
          ascentSpeed: 400, // m/h
          descentSpeed: 600, // m/h
          flatSpeed: 4000, // m/h (4 km/h = 4000 m/h)
        }
      },
      startTime: '08:00',
      distanceCalculationMethod: 'track', // 'track' or 'waypoint-to-waypoint'
      safetyTimePercentage: 20, // Safety time as percentage (20% = 20)
      suppressWaypointModificationWarning: false // Whether to suppress waypoint modification warnings
    }
  })
  const [activePanel, setActivePanel] = useState('route-manager') // 'route-manager', 'general-settings', 'route-settings', 'help', null
  const [editingWaypoint, setEditingWaypoint] = useState(null)
  const [editingRouteName, setEditingRouteName] = useState(false)
  const [editingPenalty, setEditingPenalty] = useState(null)
  const [editingRest, setEditingRest] = useState(null)
  const [editingWaypointName, setEditingWaypointName] = useState(null)
  const [editingWaypointNameValue, setEditingWaypointNameValue] = useState('')
  const [pendingEnterKey, setPendingEnterKey] = useState(false)
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('mountain-route-planner-language')
    if (saved) return saved
    
    // Detect user's preferred language from browser
    const browserLang = navigator.language || navigator.languages?.[0] || 'en'
    const langCode = browserLang.split('-')[0] // Get language code (e.g., 'fr' from 'fr-FR')
    
    // Check if browser language is supported
    const supportedLanguages = ['en', 'fr', 'es', 'ca']
    if (supportedLanguages.includes(langCode)) {
      return langCode
    }
    
    // Default to English if no supported language detected
    return 'en'
  })
  const [isDragOver, setIsDragOver] = useState(false)
  const [showNewRoute, setShowNewRoute] = useState(false)
  const [showCleanDataDialog, setShowCleanDataDialog] = useState(false)
  const [routeConfirmingDelete, setRouteConfirmingDelete] = useState(null)
  const [activityModeChangePending, setActivityModeChangePending] = useState(null)
  const [showWaypointModificationWarning, setShowWaypointModificationWarning] = useState(false)
  const [waypointModificationAction, setWaypointModificationAction] = useState(null)
  const [suppressWarningCheckbox, setSuppressWarningCheckbox] = useState(false)
  const [showNoWaypointsAlert, setShowNoWaypointsAlert] = useState(false)
  const dragCounterRef = useRef(0)

  // Translation helper
  const t = (key) => {
    return translations[language]?.[key] || translations.en[key] || key
  }

  // Get current speeds based on activity mode
  const getCurrentSpeeds = () => {
    return settings.activityModes[settings.activityMode]
  }

  // Get icon for activity mode
  const getActivityIcon = (mode) => {
    switch (mode) {
      case 'hiking':
        return <Footprints className="w-4 h-4" />
      case 'snowshoes':
        return <Snowflake className="w-4 h-4" />
      case 'skiTouring':
        return <Zap className="w-4 h-4" />
      default:
        return <Footprints className="w-4 h-4" />
    }
  }

  // Save language to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('mountain-route-planner-language', language)
  }, [language])

  // Panel visibility helpers
  const showRouteManager = activePanel === 'route-manager'
  const showSettings = activePanel === 'general-settings'
  const showRouteSettings = activePanel === 'route-settings'
  const showHelp = activePanel === 'help'

  // Simple panel toggle
  const handlePanelToggle = (panelType) => {
    setActivePanel(activePanel === panelType ? null : panelType)
  }

  // Calculate arrival time helper function
  const calculateArrivalTime = (startTime, elapsedMinutes) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    
    const arrivalDate = new Date(startDate.getTime() + elapsedMinutes * 60000);
    
    const arrivalHours = String(arrivalDate.getHours()).padStart(2, '0');
    const arrivalMinutes = String(arrivalDate.getMinutes()).padStart(2, '0');
    
    return `${arrivalHours}:${arrivalMinutes}`;
  }

  // Load routes and settings from localStorage on mount
  useEffect(() => {
    const savedRoutes = localStorage.getItem('mountainRoutes')
    const savedSettings = localStorage.getItem('mountainSettings')
    
    if (savedRoutes) {
      try {
        const parsedRoutes = JSON.parse(savedRoutes)
        // Ensure all routes have a log array (for backward compatibility)
        const routesWithLog = parsedRoutes.map(route => ({
          ...route,
          log: route.log || []
        }))
        setRoutes(routesWithLog)
      } catch (error) {
        console.error('Error loading routes from localStorage:', error)
      }
    }
    
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings)
        setSettings(parsedSettings)
      } catch (error) {
        console.error('Error loading settings from localStorage:', error)
      }
    }
  }, [])

  // Save routes to localStorage whenever they change
  useEffect(() => {
    if (routes.length > 0) {
      localStorage.setItem('mountainRoutes', JSON.stringify(routes))
    }
  }, [routes])


  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('mountainSettings', JSON.stringify(settings))
  }, [settings])

  // Get effective settings for a route (route-specific or default)
  const getEffectiveSettings = (route) => {
    // If route has its own settings, use them directly
    if (route?.settings) {
      return route.settings
    }
    
    // For routes without specific settings (legacy routes), use the global default speeds
    const currentSpeeds = getCurrentSpeeds()
    return {
      ...settings,
      ascentSpeed: currentSpeeds.ascentSpeed,
      descentSpeed: currentSpeeds.descentSpeed,
      flatSpeed: currentSpeeds.flatSpeed,
    }
  }

  // Check if route has custom speeds that differ from default mode speeds
  const hasCustomSpeeds = (route) => {
    if (!route?.settings) return false
    
    const currentMode = route.settings.activityMode || settings.activityMode
    const defaultSpeeds = settings.activityModes[currentMode]
    const routeSpeeds = route.settings
    
    return (
      routeSpeeds.ascentSpeed !== defaultSpeeds.ascentSpeed ||
      routeSpeeds.descentSpeed !== defaultSpeeds.descentSpeed ||
      routeSpeeds.flatSpeed !== defaultSpeeds.flatSpeed
    )
  }

  // Update route metadata based on last waypoint
  const updateRouteMetadata = (route, waypoints) => {
    if (!waypoints || waypoints.length === 0) return route

    const lastWaypoint = waypoints[waypoints.length - 1]
    const maxElevation = Math.max(...waypoints.map(wp => wp.elevation || 0))
    
    return {
      ...route,
      metadata: {
        ...route.metadata,
        totalDistance: lastWaypoint.totalDistance || 0,
        totalAscent: lastWaypoint.totalAscent || 0,
        totalDescent: lastWaypoint.totalDescent || 0,
        maxElevation: maxElevation
      }
    }
  }

  // Handle GPX file upload
  const handleFileUpload = async (file) => {
    if (!file) return

    try {
      const content = await file.text()
      const parsed = parseGPXFile(content, settings)
      
      // Check if no waypoints were detected in the original GPX file
      const originalWaypoints = parsed.gpxData?.waypoints || [];
      if (originalWaypoints.length === 0) {
        setShowNoWaypointsAlert(true);
      }
      
      const newRoute = {
        id: `route-${Date.now()}`,
        name: parsed.metadata.name || file.name.replace('.gpx', ''),
        gpxData: parsed.gpxData,
        gpxContent: content, // Store original GPX content as string for re-parsing
        waypoints: parsed.waypoints,
        metadata: parsed.metadata,
        log: parsed.log || [], // Include log from GPX parsing
        settings: {
          activityMode: settings.activityMode,
          ascentSpeed: getCurrentSpeeds().ascentSpeed,
          descentSpeed: getCurrentSpeeds().descentSpeed,
          flatSpeed: getCurrentSpeeds().flatSpeed,
          startTime: settings.startTime,
          distanceCalculationMethod: settings.distanceCalculationMethod,
          safetyTimePercentage: settings.safetyTimePercentage
        },
        createdAt: Date.now()
      }
      
      setRoutes(prevRoutes => [...prevRoutes, newRoute])
      setSelectedRoute(newRoute)
    } catch (error) {
      alert(`${t('errorParsingGPXFile')}: ${error.message}`)
    }
  }

  // Handle file input change
  const handleFileInputChange = async (event) => {
    const file = event.target.files[0]
    await handleFileUpload(file)
  }

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current += 1
    if (dragCounterRef.current === 1) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) {
      setIsDragOver(false)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      // Check if it's a GPX file
      if (file.name.toLowerCase().endsWith('.gpx')) {
        await handleFileUpload(file)
      } else {
        alert(t('pleaseDropGPXFile'))
      }
    }
  }

  // Update waypoint field
  const updateWaypoint = (waypointId, field, value, skipWarning = false) => {
    if (!selectedRoute) return

    // Check if this is a name modification
    const isNameModification = field === 'name';
    const currentWaypoint = selectedRoute.waypoints.find(wp => wp.id === waypointId);
    
    // For name changes, check if we need to show warning
    let shouldShowWarning = false;
    if (isNameModification && !skipWarning && !settings.suppressWaypointModificationWarning) {
      // Check if the name is actually changing
      const currentName = currentWaypoint?.name || '';
      const newName = (value || '').trim();
      if (currentName !== newName) {
        shouldShowWarning = true;
      }
    }

    const updateWaypointAction = () => {
    const updatedWaypoints = selectedRoute.waypoints.map(wp => {
      if (wp.id === waypointId) {
        return { ...wp, [field]: value }
      }
      return wp
    })

    // Create log entry for name modifications
    let logEntry = null;
    if (field === 'name' && currentWaypoint) {
      const oldName = currentWaypoint.name || '';
      const newName = (value || '').trim();
      if (oldName !== newName) {
        logEntry = createLogEntry('info', 'Waypoint renamed', {
          waypointId: waypointId,
          waypointName: newName,
          oldName: oldName,
          latitude: currentWaypoint.latitude,
          longitude: currentWaypoint.longitude
        });
      }
    }

    // Recalculate times if penalty or stop duration changed
    if (field === 'terrainDifficultyPenalty' || field === 'stopDuration') {
      const effectiveSettings = getEffectiveSettings(selectedRoute)
      const recalculated = recalculateWaypoints(updatedWaypoints, effectiveSettings)
      let updatedRouteWithWaypoints = { ...selectedRoute, waypoints: recalculated }
      
      // Add log entry if provided
      if (logEntry) {
        updatedRouteWithWaypoints = addLogEntry(updatedRouteWithWaypoints, logEntry);
      }
      
      const updatedRoute = updateRouteMetadata(updatedRouteWithWaypoints, recalculated)
      setSelectedRoute(updatedRoute)
        setRoutes(prevRoutes => prevRoutes.map(r => r.id === updatedRoute.id ? updatedRoute : r))
    } else {
      let updatedRouteWithWaypoints = { ...selectedRoute, waypoints: updatedWaypoints }
      
      // Add log entry if provided
      if (logEntry) {
        updatedRouteWithWaypoints = addLogEntry(updatedRouteWithWaypoints, logEntry);
      }
      
      const updatedRoute = updateRouteMetadata(updatedRouteWithWaypoints, updatedWaypoints)
      setSelectedRoute(updatedRoute)
        setRoutes(prevRoutes => prevRoutes.map(r => r.id === updatedRoute.id ? updatedRoute : r))
      }
    };

    // Show warning for name modifications
    if (shouldShowWarning) {
      // Store the action to execute after user confirms
      setWaypointModificationAction(() => {
        updateWaypointAction();
        // Close edit mode after action is executed
        if (editingWaypointName === waypointId) {
          setEditingWaypointName(null);
          setEditingWaypointNameValue('');
        }
        // Clear the pending Enter key flag
        setPendingEnterKey(false);
      });
      // Delay showing dialog to next event loop tick to avoid Enter key triggering dialog action
      // Use requestAnimationFrame twice to ensure the Enter key event has been fully processed
      // and the dialog has time to render before we allow Enter key events again
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShowWaypointModificationWarning(true);
          setSuppressWarningCheckbox(false);
        });
      });
      return;
    }
    
    // No warning needed, execute immediately
    updateWaypointAction();
    // Close edit mode if we were editing this waypoint
    if (editingWaypointName === waypointId) {
      setEditingWaypointName(null);
      setEditingWaypointNameValue('');
    }
  }

  const createLogEntry = (type, message, data = {}) => {
    return {
      timestamp: new Date().toISOString(),
      type,
      message,
      ...data
    };
  };

  const addLogEntry = (route, logEntry) => {
    const currentLog = route.log || [];
    return {
      ...route,
      log: [...currentLog, logEntry]
    };
  };

  const applyWaypointChanges = (updatedWaypoints, logEntry = null) => {
    if (!selectedRoute) return

    const geometryUpdated = recalculateWaypointGeometry(updatedWaypoints)
    const effectiveSettings = getEffectiveSettings(selectedRoute)
    const recalculated = recalculateWaypoints(geometryUpdated, effectiveSettings)
    let updatedRouteWithWaypoints = { ...selectedRoute, waypoints: recalculated }
    
    // Add log entry if provided
    if (logEntry) {
      updatedRouteWithWaypoints = addLogEntry(updatedRouteWithWaypoints, logEntry);
    }
    
    const updatedRoute = updateRouteMetadata(updatedRouteWithWaypoints, recalculated)

    setSelectedRoute(updatedRoute)
    setRoutes(prevRoutes => prevRoutes.map((route) => (route.id === updatedRoute.id ? updatedRoute : route)))
  }


  const showWaypointModificationWarningIfNeeded = (action) => {
    if (settings.suppressWaypointModificationWarning) {
      return true; // Skip warning, proceed with action
    }
    
    setWaypointModificationAction(() => action);
    setShowWaypointModificationWarning(true);
    setSuppressWarningCheckbox(false);
    return false; // Show warning
  };

  const handleWaypointModificationConfirm = () => {
    if (suppressWarningCheckbox) {
      // Update settings to suppress future warnings
      const newSettings = { ...settings, suppressWaypointModificationWarning: true };
      setSettings(newSettings);
      localStorage.setItem('mountainSettings', JSON.stringify(newSettings));
    }
    
    setShowWaypointModificationWarning(false);
    
    // Execute the pending action
    if (waypointModificationAction) {
      waypointModificationAction();
      setWaypointModificationAction(null);
    }
    
    // Close edit mode after confirming
    if (editingWaypointName) {
      setEditingWaypointName(null);
      setEditingWaypointNameValue('');
    }
  };

  const handleWaypointModificationCancel = () => {
    setShowWaypointModificationWarning(false);
    setWaypointModificationAction(null);
    setPendingEnterKey(false);
    
    // Revert the name change and close edit mode
    if (editingWaypointName) {
      // Reset to original name
      const waypoint = selectedRoute?.waypoints.find(wp => wp.id === editingWaypointName);
      if (waypoint) {
        setEditingWaypointNameValue(waypoint.name || '');
      }
      setEditingWaypointName(null);
      setEditingWaypointNameValue('');
    }
  };
  
  // Prevent Enter key from closing dialog when it was just pressed in input field
  useEffect(() => {
    if (!showWaypointModificationWarning || !pendingEnterKey) return;
    
    const handleKeyDown = (e) => {
      // If Enter key is pressed and we're in the pending state, prevent default action
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    
    // Add event listener with capture phase to catch the event early
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    
    // Clear the pending flag after a short delay
    const timeoutId = setTimeout(() => {
      setPendingEnterKey(false);
    }, 150);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      clearTimeout(timeoutId);
    };
  }, [showWaypointModificationWarning, pendingEnterKey]);

  const handleAddWaypointAtPosition = ({ lat, lng }) => {
    if (!selectedRoute) return
    if (!isFinite(lat) || !isFinite(lng)) return
    
    const addWaypoint = () => {
      const trackPoints =
        selectedRoute.gpxData?.tracks?.flatMap((track) => track.points || []) ?? []
      const nearestTrackPoint = findNearestTrackPoint(lat, lng, trackPoints)
      const snappedLat = nearestTrackPoint?.latitude ?? lat
      const snappedLng = nearestTrackPoint?.longitude ?? lng

      const { insertIndex, ratio, previousWaypoint, nextWaypoint } = findInsertionDetails(
        snappedLat,
        snappedLng,
        selectedRoute.waypoints
      )

      const interpolatedElevation =
        isFinite(previousWaypoint?.elevation) && isFinite(nextWaypoint?.elevation)
          ? previousWaypoint.elevation +
            (nextWaypoint.elevation - previousWaypoint.elevation) * ratio
          : previousWaypoint?.elevation ?? nextWaypoint?.elevation ?? 0

      const defaultElevation =
        nearestTrackPoint && isFinite(nearestTrackPoint.elevation)
          ? nearestTrackPoint.elevation
          : interpolatedElevation

      const newWaypoint = {
        id: `waypoint-${Date.now()}`,
        name: `${t('waypoint')} ${insertIndex}`,
        isDecisionPoint: false,
        isStartPoint: false,
        isEndPoint: false,
        latitude: snappedLat,
        longitude: snappedLng,
        elevation: defaultElevation,
        terrainDifficultyPenalty: 0,
        stopDuration: 0,
        segmentDistance: 0,
        segmentAscent: 0,
        segmentDescent: 0,
        totalDistance: 0,
        totalAscent: 0,
        totalDescent: 0,
        segmentTime: 0,
        totalTime: 0,
        timeTillArrival: 0,
        hour: '',
        comments: '',
        utm: ''
      }

      const updatedWaypoints = [
        ...selectedRoute.waypoints.slice(0, insertIndex),
        newWaypoint,
        ...selectedRoute.waypoints.slice(insertIndex)
      ]

      const logEntry = createLogEntry('info', 'Waypoint added via map', {
        waypointId: newWaypoint.id,
        waypointName: newWaypoint.name,
        latitude: snappedLat,
        longitude: snappedLng,
        elevation: defaultElevation,
        insertIndex
      });

      applyWaypointChanges(updatedWaypoints, logEntry)
    };

    if (!showWaypointModificationWarningIfNeeded(addWaypoint)) {
      return; // Warning dialog will handle the action
    }
    
    addWaypoint();
  }

  const handleRemoveWaypoint = (waypointId) => {
    if (!selectedRoute) return

    const waypointToRemove = selectedRoute.waypoints.find((wp) => wp.id === waypointId)
    if (!waypointToRemove) return
    if (waypointToRemove.isStartPoint || waypointToRemove.isEndPoint) {
      console.warn('Start and end waypoints cannot be removed.')
      return
    }

    const removeWaypoint = () => {
      const updatedWaypoints = selectedRoute.waypoints.filter((wp) => wp.id !== waypointId)
      
      const logEntry = createLogEntry('info', 'Waypoint removed via map', {
        waypointId: waypointToRemove.id,
        waypointName: waypointToRemove.name,
        latitude: waypointToRemove.latitude,
        longitude: waypointToRemove.longitude
      });

      applyWaypointChanges(updatedWaypoints, logEntry)
    };

    if (!showWaypointModificationWarningIfNeeded(removeWaypoint)) {
      return; // Warning dialog will handle the action
    }
    
    removeWaypoint();
  }

  const getWaypointDisplayName = (waypoint) =>
    buildWaypointDisplayName(selectedRoute, waypoint, t)

  // Delete route
  const deleteRoute = (routeId) => {
    setRoutes(prevRoutes => prevRoutes.filter(r => r.id !== routeId))
    if (selectedRoute?.id === routeId) {
      setSelectedRoute(null)
    }
    setRouteConfirmingDelete(null)
  }

  // Handle delete route confirmation - show tooltip
  const handleDeleteRouteClick = (routeId) => {
    setRouteConfirmingDelete(routeId)
  }

  // Confirm delete route
  const confirmDeleteRoute = (routeId) => {
    deleteRoute(routeId)
  }

  // Cancel delete route
  const cancelDeleteRoute = () => {
    setRouteConfirmingDelete(null)
  }

  // Handle activity mode change - show confirmation if custom speeds exist
  const handleActivityModeChange = (newActivityMode) => {
    if (selectedRoute && hasCustomSpeeds(selectedRoute)) {
      setActivityModeChangePending(newActivityMode)
    } else {
      // No custom speeds, change directly
      updateRouteSettings('activityMode', newActivityMode)
    }
  }

  // Confirm activity mode change
  const confirmActivityModeChange = () => {
    if (activityModeChangePending) {
      updateRouteSettings('activityMode', activityModeChangePending)
      setActivityModeChangePending(null)
    }
  }

  // Cancel activity mode change
  const cancelActivityModeChange = () => {
    setActivityModeChangePending(null)
  }

  // Update default settings
  const updateDefaultSettings = (field, value) => {
    let newSettings
    if (['ascentSpeed', 'descentSpeed', 'flatSpeed'].includes(field)) {
      // Update speed for current activity mode
      newSettings = {
        ...settings,
        activityModes: {
          ...settings.activityModes,
          [settings.activityMode]: {
            ...settings.activityModes[settings.activityMode],
            [field]: value
          }
        }
      }
    } else {
      newSettings = { ...settings, [field]: value }
    }

    if (field === 'distanceCalculationMethod') {
      setSettings(newSettings)
      if (selectedRoute) {
        updateRouteSettings('distanceCalculationMethod', value)
      }
      return
    }

    setSettings(newSettings)
    
    // General settings changes should not affect existing routes
    // Only new routes will use the updated general settings
    // Existing routes maintain their own independent settings
  }

  // Update route-specific settings
  const updateRouteSettings = async (field, value) => {
    if (!selectedRoute) return
    
    let newRouteSettings = { 
      ...getEffectiveSettings(selectedRoute), 
      [field]: value 
    }
    
    // If activity mode is changed, update speeds to match the new mode
    if (field === 'activityMode') {
      const newModeSpeeds = settings.activityModes[value]
      newRouteSettings = {
        ...newRouteSettings,
        ascentSpeed: newModeSpeeds.ascentSpeed,
        descentSpeed: newModeSpeeds.descentSpeed,
        flatSpeed: newModeSpeeds.flatSpeed,
      }
    }
    
    // If distance calculation method is changed, we need to reparse the GPX file
    if (field === 'distanceCalculationMethod') {
      try {
        // Use the stored original GPX content if available, otherwise we can't reparse
        if (!selectedRoute.gpxContent) {
          alert('Cannot change distance calculation method for this route. Please reload the GPX file to enable this feature.')
          return
        }
        
        // Re-parse the GPX with new distance calculation method
        const parsed = parseGPXFile(selectedRoute.gpxContent, newRouteSettings)
        
        // Preserve existing log entries when re-parsing, maintaining read status
        const existingLog = selectedRoute.log || []
        const newLog = parsed.log || []
        // Create a map of existing log entries by timestamp and type to preserve read status
        const existingLogMap = new Map();
        existingLog.forEach((entry, index) => {
          const key = `${entry.timestamp}-${entry.type}-${entry.message}`;
          if (entry.read !== undefined) {
            existingLogMap.set(key, entry.read);
          }
        });
        // Merge logs, preserving read status from existing logs
        const mergedLog = [...existingLog, ...newLog].map(entry => {
          const key = `${entry.timestamp}-${entry.type}-${entry.message}`;
          if (existingLogMap.has(key)) {
            return { ...entry, read: existingLogMap.get(key) };
          }
          return entry;
        });
        
        // Merge new waypoints with existing waypoints to preserve user modifications
        const mergedWaypoints = parsed.waypoints.map((newWaypoint, index) => {
          // First try to find by same position (latitude/longitude)
          let existingWaypoint = selectedRoute.waypoints.find(wp => 
            Math.abs(wp.latitude - newWaypoint.latitude) < 0.0001 && 
            Math.abs(wp.longitude - newWaypoint.longitude) < 0.0001
          )
          
          // If not found by position, try by index as fallback
          if (!existingWaypoint && selectedRoute.waypoints[index]) {
            existingWaypoint = selectedRoute.waypoints[index]
          }
          
          // If we found an existing waypoint, preserve user modifications
          if (existingWaypoint) {
            return {
              ...newWaypoint, // Use new distance/time calculations from re-parsing
              // Preserve user modifications
              terrainDifficultyPenalty: existingWaypoint.terrainDifficultyPenalty,
              stopDuration: existingWaypoint.stopDuration,
              comments: existingWaypoint.comments,
              isDecisionPoint: existingWaypoint.isDecisionPoint,
              id: existingWaypoint.id, // Preserve existing ID to maintain stability
              // Preserve user-modified name unless it's clearly auto-generated
              name: existingWaypoint.name && 
                    !existingWaypoint.name.match(/^(Waypoint|Point) \d+$/) ? 
                    existingWaypoint.name : newWaypoint.name
            }
          }
          
          // No matching existing waypoint, use the new one as-is
          return newWaypoint
        })
        
        // Recalculate times with preserved penalties and rest times
        const recalculatedWaypoints = recalculateWaypoints(mergedWaypoints, newRouteSettings)
        
        // Update metadata based on the recalculated waypoints
        const updatedRouteWithWaypoints = { 
          ...selectedRoute, 
          waypoints: recalculatedWaypoints,
          settings: newRouteSettings,
          gpxData: parsed.gpxData,
          metadata: parsed.metadata,
          log: mergedLog
        }
        const updatedRoute = updateRouteMetadata(updatedRouteWithWaypoints, recalculatedWaypoints)
    
      setSelectedRoute(updatedRoute)
      setRoutes(prevRoutes => prevRoutes.map(r => r.id === updatedRoute.id ? updatedRoute : r))
        return
      } catch (error) {
        console.error('Error re-parsing GPX with new distance method:', error)
        alert(`Error updating distance calculation method: ${error.message}`)
        return
      }
    }
    
    const updatedRouteWithSettings = { ...selectedRoute, settings: newRouteSettings }
    const recalculated = recalculateWaypoints(updatedRouteWithSettings.waypoints, newRouteSettings)
    const updatedRouteWithWaypoints = { ...updatedRouteWithSettings, waypoints: recalculated }
    const updatedRoute = updateRouteMetadata(updatedRouteWithWaypoints, recalculated)
    
    setSelectedRoute(updatedRoute)
    setRoutes(prevRoutes => prevRoutes.map(r => r.id === updatedRoute.id ? updatedRoute : r))
  }

  // Export to GPX
  const handleExportGPX = () => {
    if (!selectedRoute) {
      alert(t('pleaseSelectRoute'))
      return
    }

    try {
      const gpxContent = exportRouteToGPX(selectedRoute)
      const modifications = checkWaypointModifications(selectedRoute)
      
      // Create and download file
      const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${selectedRoute.name || 'route'}.gpx`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting GPX:', error)
      alert(`Error exporting GPX: ${error.message}`)
    }
  }

  // Export to PDF
  const handleExportPDF = () => {
    if (!selectedRoute) {
      alert(t('pleaseSelectRoute'))
      return
    }
    exportRouteToPDF(selectedRoute, settings, language)
  }

  // Export to CSV
  const handleExportCSV = () => {
    if (!selectedRoute) {
      alert(t('pleaseSelectRoute'))
      return
    }

    // Helper function to format time in hours and minutes
    const formatTimeHoursMinutesForMin = (minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      if (hours > 0) {
        return `${hours}h ${mins}min`;
      } else {
        return `${mins}min`;
      }
    };

    // CSV headers with units
    const headers = [
      t('waypointHeader'),
      'Position_UTM',
      'Position_Elevation_m',
      'Segment_Ascent_m',
      'Segment_Descent_m', 
      'Segment_Distance_km',
      'Route_Ascent_m',
      'Route_Descent_m',
      'Route_Distance_km',
      'Segment_Time',
      'Penalty_percent',
      'Penalty_Time',
      'Rest_min',
      'Total_Time',
      'Progression_percent',
      t('timeHeader'),
      t('notesHeader'),
      'Decision_Point'
    ];

    // Create CSV data
    const csvData = selectedRoute.waypoints.map((wp, index) => {
      const displayName = getWaypointDisplayName(wp)
      const penaltyDisplay = `${(wp.terrainDifficultyPenalty * 100).toFixed(0)}%`;
      
      const penaltyTime = wp.terrainDifficultyPenalty > 0 ? 
        formatTimeHoursMinutesForMin(wp.segmentTime * wp.terrainDifficultyPenalty) : '';

      return [
        displayName,
        wp.utm ? wp.utm.replace(/^Zone \d+ /, '') : 'N/A',
        wp.elevation?.toFixed(0) || '0',
        index === 0 ? '' : (wp.segmentAscent?.toFixed(0) || '0'),
        index === 0 ? '' : (wp.segmentDescent?.toFixed(0) || '0'),
        index === 0 ? '' : (wp.segmentDistance?.toFixed(2) || '0.00'),
        wp.totalAscent?.toFixed(0) || '0',
        wp.totalDescent?.toFixed(0) || '0',
        wp.totalDistance?.toFixed(2) || '0.00',
        index === 0 ? '' : formatTimeHoursMinutesForMin(wp.segmentTime || 0),
        penaltyDisplay,
        penaltyTime,
        index === 0 ? '' : (wp.stopDuration?.toFixed(0) || '0'),
        formatTimeHoursMinutesForMin(wp.totalTime || 0),
        selectedRoute.waypoints.length > 0 ? 
          `${Math.round(((wp.totalTime || 0) / (selectedRoute.waypoints[selectedRoute.waypoints.length - 1].totalTime || 1)) * 100)}%` : 
          '0%',
        wp.hour || '',
        wp.comments || '',
        wp.isDecisionPoint ? t('yes') : t('no')
      ];
    });

    // Add safety time row if there are waypoints
    if (selectedRoute.waypoints.length > 0) {
      const lastWaypoint = selectedRoute.waypoints[selectedRoute.waypoints.length - 1];
      const effectiveSettings = getEffectiveSettings(selectedRoute);
      const safetyTime = (lastWaypoint.totalTime * (effectiveSettings.safetyTimePercentage / 100));
      const totalWithSafety = lastWaypoint.totalTime + safetyTime;
      
      // Calculate arrival time with safety
      const arrivalTime = calculateArrivalTime(effectiveSettings.startTime || '08:00', totalWithSafety);

      const safetyRow = [
        `Safety Time (${effectiveSettings.safetyTimePercentage}%)`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        formatTimeHoursMinutesForMin(safetyTime),
        '',
        '',
        '',
        formatTimeHoursMinutesForMin(totalWithSafety),
        `100+${effectiveSettings.safetyTimePercentage}%`,
        arrivalTime,
        '',
        ''
      ];
      
      csvData.push(safetyRow);
    }

    // Convert to CSV string
    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell).join(','))
      .join('\n');

    // Create and download file
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${selectedRoute.name || 'route'}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert(`Error exporting CSV: ${error.message}`);
    }
  }

  // Clean all data
  const handleCleanAllData = () => {
    // Clear all routes
    setRoutes([])
    setSelectedRoute(null)
    
    // Reset settings to defaults
    const defaultSettings = {
      activityMode: 'hiking',
      activityModes: {
        hiking: {
          ascentSpeed: 300,
          descentSpeed: 400,
          flatSpeed: 5000,
        },
        snowshoes: {
          ascentSpeed: 200,
          descentSpeed: 300,
          flatSpeed: 3000,
        },
        skiTouring: {
          ascentSpeed: 400,
          descentSpeed: 600,
          flatSpeed: 4000,
        }
      },
      startTime: '08:00',
      distanceCalculationMethod: 'track',
      safetyTimePercentage: 20
    }
    setSettings(defaultSettings)
    
    // Clear localStorage
    localStorage.removeItem('mountainRoutes')
    localStorage.removeItem('mountainSettings')
    localStorage.removeItem('mountain-route-planner-language')
    
    // Close dialog
    setShowCleanDataDialog(false)
  }

  return (
    <div className="min-h-screen p-6 relative">
      <GitHubCorner url="https://github.com/Campano/gpx-route-planner/issues" />
      
      {/* Beta Version Notice Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-2 -m-6 mb-6">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">{t('betaVersion')}:</span>
          <span>
            {t('betaNotice')}{' '}
            <a 
              href="https://github.com/Campano/gpx-route-planner/issues" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-blue-900 dark:hover:text-blue-100"
            >
              {t('issuesPage')}
            </a>
            .
          </span>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto space-y-6 panel-transition">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl p-6 shadow-mountain-lg bg-card">
          <div className="flex items-center gap-3">
            <Mountain className="w-10 h-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t('appTitle')}</h1>
              <p className="text-sm text-muted-foreground">{t('appDescription')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="btn-primary"
              onClick={() => handlePanelToggle('route-manager')}
              title={showRouteManager ? t("hideRouteManager") : t("showRouteManager")}
            >
              {showRouteManager ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  {t('routeManager')}
                </>
              ) : (
                <>
                  <FolderOpen className="w-4 h-4 mr-2" />
                  {t('routeManager')}
                </>
              )}
            </Button>
          <Button
            variant="outline"
            size="sm"
            className="btn-primary"
              onClick={() => handlePanelToggle('general-settings')}
              title={showSettings ? t("hideSettings") : t("showSettings")}
            >
              {showSettings ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  {t('generalSettings')}
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4 mr-2" />
                  {t('generalSettings')}
                </>
              )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="btn-primary"
            onClick={() => handlePanelToggle('help')}
            title={showHelp ? t("hideHelp") : t("showHelp")}
          >
            {showHelp ? (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                {t('help')}
              </>
            ) : (
              <>
                <HelpCircle className="w-4 h-4 mr-2" />
                {t('help')}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="btn-donate"
            onClick={() => window.open('https://github.com/sponsors/Campano', '_blank')}
            title={t("donateToKeep")}
          >
            <Heart className="w-4 h-4 mr-2 heartbeat-icon" />
            {t('donate')}
          </Button>
          </div>
        </div>


            {/* Route Details and Panels */}
            <div className="flex flex-col-reverse lg:flex-row gap-6 panel-slide-in">
          {/* Waypoint Table - Main content */}
          <div className={`flex-1 ${activePanel ? 'lg:w-2/3' : 'w-full'} ${activePanel ? 'lg:order-1' : ''}`}>
          <Card className="shadow-mountain-lg">
            {selectedRoute && (
              <>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                      <CardTitle className="flex items-center gap-2">
                        {editingRouteName ? (
                          <Input
                            value={selectedRoute.name || ''}
                            onChange={(e) => {
                              const updatedRoute = { ...selectedRoute, name: e.target.value };
                              setSelectedRoute(updatedRoute);
                              setRoutes(prevRoutes => prevRoutes.map(r => r.id === selectedRoute.id ? updatedRoute : r));
                            }}
                            onBlur={() => setEditingRouteName(false)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setEditingRouteName(false);
                              }
                              if (e.key === 'Escape') {
                                setEditingRouteName(false);
                              }
                            }}
                            className="text-lg font-semibold border-none p-0 h-auto bg-transparent focus:ring-0"
                            placeholder={t("routeName")}
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold">{selectedRoute.name || t('unnamedRoute')}</span>
                            <button
                              onClick={() => setEditingRouteName(true)}
                              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                              title={t("editRouteName")}
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </CardTitle>
                    <CardDescription>
                      <div className="text-xs space-y-1">
                        <div className="font-medium">
                          {selectedRoute.waypoints.length} waypoints • {selectedRoute.metadata?.totalDistance?.toFixed(2) || '0.00'} km • +{selectedRoute.metadata?.totalAscent?.toFixed(0) || '0'}m • -{selectedRoute.metadata?.totalDescent?.toFixed(0) || '0'}m • {selectedRoute.metadata?.maxElevation?.toFixed(0) || '0'}m max
                        </div>
                        <div 
                          className="text-muted-foreground"
                          dangerouslySetInnerHTML={{
                            __html: (() => {
                              const lastWaypoint = selectedRoute.waypoints[selectedRoute.waypoints.length - 1];
                              const totalWithSafety = lastWaypoint.totalTime * (1 + (getEffectiveSettings(selectedRoute).safetyTimePercentage || 0) / 100);
                              const startTime = getEffectiveSettings(selectedRoute).startTime;
                              const [startHours, startMinutes] = startTime.split(':').map(Number);
                              const totalMinutes = startHours * 60 + startMinutes + Math.round(totalWithSafety);
                              const endingHours = Math.floor(totalMinutes / 60);
                              const endingMinutes = Math.round(totalMinutes % 60);
                              const endingTime = `${endingHours.toString().padStart(2, '0')}:${endingMinutes.toString().padStart(2, '0')}`;
                              const duration = formatTimeHoursMinutes(totalWithSafety);
                              const utmZones = [...new Set(selectedRoute.waypoints.map(wp => {
                                if (!wp.utm) return null;
                                const match = wp.utm.match(/Zone (\d+[A-Z])/);
                                return match ? match[1] : null;
                              }).filter(Boolean))];
                              const utmZone = utmZones.length > 0 ? utmZones.join(', ') : 'N/A';
                              const activityMode = getEffectiveSettings(selectedRoute).activityMode || settings.activityMode;
                              const ascentSpeed = getEffectiveSettings(selectedRoute).ascentSpeed;
                              const descentSpeed = getEffectiveSettings(selectedRoute).descentSpeed;
                              const flatSpeed = getEffectiveSettings(selectedRoute).flatSpeed;
                              return `${duration} • ${startTime}-${endingTime} • ${utmZone} • ${t(activityMode)} (<span class="text-xs">↑${ascentSpeed} ↓${descentSpeed} →${flatSpeed} m/h</span>)`;
                            })()
                          }}
                        />
                      </div>
                  </CardDescription>
                </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="btn-primary relative"
                        onClick={() => handlePanelToggle('route-settings')}
                        title={showRouteSettings ? "Hide configuration" : "Configure route-specific settings"}
                      >
                        {showRouteSettings ? (
                          <>
                            <EyeOff className="w-4 h-4 mr-2" />
                            {t('routeSettings')}
                          </>
                        ) : (
                          <>
                            <Settings2 className="w-4 h-4 mr-2" />
                            {t('routeSettings')}
                          </>
                        )}
                      </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedRoute ? (
                <div className="space-y-6">
                  {selectedRoute?.waypoints?.length > 0 && (
                    <div className="h-96 w-full overflow-hidden rounded-lg border border-border">
                      <RouteMap
                        route={selectedRoute}
                        onAddWaypoint={handleAddWaypointAtPosition}
                        onRemoveWaypoint={handleRemoveWaypoint}
                        getWaypointDisplayName={getWaypointDisplayName}
                        panelState={activePanel}
                      />
                    </div>
                  )}
                  {/* Waypoint Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                          {/* Group Header Row */}
                          <TableRow>
                            <TableHead rowSpan={2} className="w-40 text-center bg-muted/50">{t('waypoint')}</TableHead>
                            <TableHead colSpan={3} className="text-center bg-muted/50">{t('distance')}</TableHead>
                            <TableHead colSpan={6} className="text-center bg-muted/50">{t('timing')}</TableHead>
                            <TableHead rowSpan={2} className="w-48 min-w-48 max-w-48 text-center bg-muted/50">{t('notes')}</TableHead>
                          </TableRow>
                          {/* Column Header Row */}
                          <TableRow>
                            <TableHead className="w-32 text-center bg-muted/30">Position</TableHead>
                            <TableHead className="w-24 text-center bg-muted/30">{t('segment')}</TableHead>
                            <TableHead className="w-24 text-center bg-muted/30">{t('route')}</TableHead>
                            <TableHead className="w-24 text-center bg-muted/30">{t('segmentTime')}</TableHead>
                            <TableHead className="w-24 text-center bg-muted/30">{t('penalty')}</TableHead>
                            <TableHead className="w-24 text-center bg-muted/30">{t('rest')}</TableHead>
                            <TableHead className="w-24 text-center bg-muted/30">{t('total')}</TableHead>
                            <TableHead className="w-24 text-center bg-muted/30">{t('progression')}</TableHead>
                            <TableHead className="w-24 text-center bg-muted/30">{t('time')}</TableHead>
                          </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRoute.waypoints.map((waypoint, index) => (
                        <TableRow key={waypoint.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                              {/* Waypoint Column */}
                              <TableCell className="w-40">
                                <div className="space-y-1">
                                  <div 
                                    className={`h-8 px-2 py-1 text-xs font-medium rounded border flex items-center group ${
                                    waypoint.isStartPoint ? 'bg-green-100 text-green-800 border-green-300' :
                                    waypoint.isEndPoint ? 'bg-red-100 text-red-800 border-red-300' :
                                      'bg-muted/30 cursor-pointer hover:bg-muted/50'
                                    } ${editingWaypointName === waypoint.id ? '' : ''}`}
                                    onClick={() => {
                                      // Allow editing names for all waypoints except synthetic start/end points
                                      // For start/end points, only allow editing if they don't match another waypoint
                                      if (!waypoint.isStartPoint && !waypoint.isEndPoint) {
                                        // Regular waypoint - always allow editing
                                        setEditingWaypointName(waypoint.id);
                                        setEditingWaypointNameValue(waypoint.name || '');
                                      } else {
                                        // For start/end points, check if there's a matching waypoint at the same location
                                        // If there is, we can't edit the synthetic point's name (should edit the matching waypoint instead)
                                        // If there isn't, allow editing the synthetic point's name
                                        const matchingWaypoint = selectedRoute.waypoints.find(
                                          (wp) => wp.id !== waypoint.id && 
                                          !wp.isStartPoint && !wp.isEndPoint &&
                                          Math.abs(wp.latitude - waypoint.latitude) < 0.0001 &&
                                          Math.abs(wp.longitude - waypoint.longitude) < 0.0001
                                        );
                                        if (!matchingWaypoint) {
                                          // No matching waypoint, allow editing the synthetic point's name
                                          setEditingWaypointName(waypoint.id);
                                          setEditingWaypointNameValue(waypoint.name || '');
                                        }
                                      }
                                    }}
                                  >
                                    {editingWaypointName === waypoint.id ? (
                                      <Input
                                        value={editingWaypointNameValue}
                                        onChange={(e) => setEditingWaypointNameValue(e.target.value)}
                                        onBlur={() => {
                                          // Only update if the value changed
                                          const trimmedValue = editingWaypointNameValue.trim();
                                          const currentName = waypoint.name || '';
                                          if (trimmedValue !== currentName) {
                                            updateWaypoint(waypoint.id, 'name', trimmedValue || '');
                                          }
                                          setEditingWaypointName(null);
                                          setEditingWaypointNameValue('');
                                        }}
                                        onKeyDown={(e) => {
                                          // Handle Enter key
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.nativeEvent.stopImmediatePropagation();
                                            
                                            // Set flag to indicate we're processing an Enter key press
                                            // This will prevent the dialog from immediately closing
                                            setPendingEnterKey(true);
                                            
                                            // Update if value changed
                                            const trimmedValue = editingWaypointNameValue.trim();
                                            const currentName = waypoint.name || '';
                                            
                                            if (trimmedValue !== currentName) {
                                              // Call updateWaypoint which will show warning dialog if needed
                                              // Don't close edit mode yet - wait for user to confirm in dialog
                                              updateWaypoint(waypoint.id, 'name', trimmedValue || '');
                                              // Note: edit mode will be closed in handleWaypointModificationConfirm
                                            } else {
                                              // No change, just close edit mode
                                              setPendingEnterKey(false);
                                              setEditingWaypointName(null);
                                              setEditingWaypointNameValue('');
                                            }
                                            return false;
                                          }
                                          
                                          // Handle Escape key
                                          if (e.key === 'Escape') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.nativeEvent.stopImmediatePropagation();
                                            setPendingEnterKey(false);
                                            setEditingWaypointName(null);
                                            setEditingWaypointNameValue('');
                                            return false;
                                          }
                                          
                                          // For all other keys, stop propagation to prevent dialog from closing
                                          e.stopPropagation();
                                        }}
                                        className="h-6 text-xs px-1"
                                        placeholder={waypoint.isStartPoint ? t('start') : waypoint.isEndPoint ? t('end') : t('waypoint')}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                        onFocus={(e) => e.stopPropagation()}
                                      />
                                    ) : (
                                      <span className="truncate flex-1">{getWaypointDisplayName(waypoint)}</span>
                                    )}
                                    {editingWaypointName !== waypoint.id && !waypoint.isStartPoint && !waypoint.isEndPoint && (
                                      <Edit3 className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-50" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 justify-center">
                                    <input
                                      type="checkbox"
                                      checked={waypoint.isDecisionPoint}
                                      onChange={(e) => updateWaypoint(waypoint.id, 'isDecisionPoint', e.target.checked)}
                                      className="w-4 h-4"
                                      disabled={waypoint.isStartPoint || waypoint.isEndPoint}
                                    />
                                    <span className="text-xs">{t('decisionPoint')}</span>
                                  </div>
                                </div>
                              </TableCell>
                              {/* Position Column */}
                              <TableCell className="w-32">
                                <div className="space-y-1 text-xs text-center">
                                  <div className="text-muted-foreground">
                                    {waypoint.utm ? waypoint.utm.replace(/^Zone \d+ /, '') : 'N/A'}
                                  </div>
                                  <div className="font-medium">
                                      {waypoint.elevation.toFixed(0)}m
                                  </div>
                                </div>
                              </TableCell>
                          {/* Segment Columns */}
                          <TableCell className="text-xs text-center">
                            {index === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                            <div className="space-y-1">
                              <div className="text-green-600 font-medium">↑{waypoint.segmentAscent.toFixed(0)}m</div>
                              <div className="text-red-600 font-medium">↓{waypoint.segmentDescent.toFixed(0)}m</div>
                              <div className="text-blue-600 font-medium">{waypoint.segmentDistance.toFixed(2)}km</div>
                            </div>
                            )}
                          </TableCell>
                          {/* Route Columns */}
                          <TableCell className="text-xs text-center">
                            <div className="space-y-1">
                              <div className="text-green-600 font-medium">↑{waypoint.totalAscent.toFixed(0)}m</div>
                              <div className="text-red-600 font-medium">↓{waypoint.totalDescent.toFixed(0)}m</div>
                              <div className="text-blue-600 font-medium">{waypoint.totalDistance.toFixed(2)}km</div>
                            </div>
                          </TableCell>
                          {/* Timing Columns */}
                          <TableCell className="text-xs text-center">
                            {index === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              formatTimeHoursMinutesForMin(waypoint.segmentTime)
                            )}
                          </TableCell>
                          <TableCell 
                            className="penalty-cell group"
                            onClick={() => editingPenalty !== waypoint.id && setEditingPenalty(waypoint.id)}
                          >
                            {index === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : editingPenalty === waypoint.id ? (
                <Input
                  type="number"
                                value={(waypoint.terrainDifficultyPenalty * 100).toFixed(0)}
                                onChange={(e) => updateWaypoint(waypoint.id, 'terrainDifficultyPenalty', (parseFloat(e.target.value) || 0) / 100)}
                                onBlur={() => setEditingPenalty(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setEditingPenalty(null);
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingPenalty(null);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                  step="0.1"
                              className="h-8 text-xs w-20 text-center"
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-xs penalty-text">
                                  {(waypoint.terrainDifficultyPenalty * 100).toFixed(0)}%
                                  {waypoint.terrainDifficultyPenalty > 0 && (
                                    <span className="text-muted-foreground">
                                      {' '}({formatTimeHoursMinutesForMin(waypoint.segmentTime * waypoint.terrainDifficultyPenalty)})
                                    </span>
                                  )}
                                </span>
                                <Edit3 className="w-3 h-3 text-muted-foreground penalty-icon flex-shrink-0" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell 
                            className="rest-cell group"
                            onClick={() => editingRest !== waypoint.id && setEditingRest(waypoint.id)}
                          >
                            {index === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : editingRest === waypoint.id ? (
                <Input
                  type="number"
                              value={waypoint.stopDuration}
                              onChange={(e) => updateWaypoint(waypoint.id, 'stopDuration', parseFloat(e.target.value) || 0)}
                                onBlur={() => setEditingRest(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setEditingRest(null);
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingRest(null);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              className="h-8 text-xs w-20 text-center"
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-xs rest-text">{waypoint.stopDuration.toFixed(0)}min</span>
                                <Edit3 className="w-3 h-3 text-muted-foreground rest-icon flex-shrink-0" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-center">{formatTimeHoursMinutesForMin(waypoint.totalTime)}</TableCell>
                          <TableCell className="text-xs text-center">
                            {(() => {
                              const lastWaypoint = selectedRoute.waypoints[selectedRoute.waypoints.length - 1];
                              const percentage = lastWaypoint.totalTime > 0 ? Math.round((waypoint.totalTime / lastWaypoint.totalTime) * 100) : 0;
                              return `${percentage}%`;
                            })()}
                          </TableCell>
                          <TableCell className="text-xs text-center">{waypoint.hour}</TableCell>
                          {/* Notes Column */}
                          <TableCell 
                            className="w-48 min-w-48 max-w-48 note-cell group"
                            onClick={() => editingWaypoint !== waypoint.id && setEditingWaypoint(waypoint.id)}
                          >
                            {editingWaypoint === waypoint.id ? (
                              <Textarea
                                value={waypoint.comments}
                                onChange={(e) => updateWaypoint(waypoint.id, 'comments', e.target.value)}
                                className="min-h-8 text-xs resize-none w-full"
                                placeholder="Notes..."
                                rows={3}
                                onBlur={() => setEditingWaypoint(null)}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-start gap-2 w-full">
                                <div className="flex-1 text-xs break-words whitespace-pre-wrap break-all note-text">
                                  {waypoint.comments || (
                                    <span className="text-muted-foreground italic note-placeholder">No notes</span>
                                  )}
                                </div>
                                <Edit3 className="w-3 h-3 text-muted-foreground note-icon flex-shrink-0" />
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                          ))}
                          
                          {/* Safety Time Row */}
                          {selectedRoute.waypoints.length > 0 && (
                            <TableRow className="bg-muted/20 font-medium">
                              {/* Waypoint Column */}
                              <TableCell className="w-40">
                                <div className="text-xs font-medium text-center">
                                  {t('safetyTime')} ({getEffectiveSettings(selectedRoute).safetyTimePercentage}%)
                                </div>
                              </TableCell>
                              {/* Position Column - Empty */}
                              <TableCell className="w-32"></TableCell>
                              {/* Segment Column - Empty */}
                              <TableCell></TableCell>
                              {/* Route Column - Empty */}
                              <TableCell></TableCell>
                              {/* Timing Columns - Show Safety Time */}
                              <TableCell className="text-xs text-center font-medium">
                                {(() => {
                                  const lastWaypoint = selectedRoute.waypoints[selectedRoute.waypoints.length - 1];
                                  const safetyTime = (lastWaypoint.totalTime * (getEffectiveSettings(selectedRoute).safetyTimePercentage / 100));
                                  return formatTimeHoursMinutesForMin(safetyTime);
                                })()}
                              </TableCell>
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-xs text-center font-medium">
                                {(() => {
                                  const lastWaypoint = selectedRoute.waypoints[selectedRoute.waypoints.length - 1];
                                  const totalWithSafety = lastWaypoint.totalTime + (lastWaypoint.totalTime * (getEffectiveSettings(selectedRoute).safetyTimePercentage / 100));
                                  return formatTimeHoursMinutesForMin(totalWithSafety);
                                })()}
                              </TableCell>
                              <TableCell className="text-xs text-center font-medium">
                                {(() => {
                                  const safetyPercentage = getEffectiveSettings(selectedRoute).safetyTimePercentage;
                                  return `${100 + safetyPercentage}%`;
                                })()}
                              </TableCell>
                              <TableCell className="text-xs text-center font-medium">
                                {(() => {
                                  const lastWaypoint = selectedRoute.waypoints[selectedRoute.waypoints.length - 1];
                                  const totalWithSafety = lastWaypoint.totalTime + (lastWaypoint.totalTime * (getEffectiveSettings(selectedRoute).safetyTimePercentage / 100));
                                  return calculateArrivalTime(getEffectiveSettings(selectedRoute).startTime, totalWithSafety);
                                })()}
                              </TableCell>
                              {/* Notes Column - Empty */}
                              <TableCell></TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                </div>
                </div>
              ) : (
                <div className="py-12">
                  <div className="text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('noRouteSelectedDesc')}
                    </p>
                    {!showRouteManager && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="btn-primary"
                        onClick={() => handlePanelToggle('route-manager')}
                        title="Show route manager"
                      >
                        <FolderOpen className="w-4 h-4 mr-2" />
                        {t('routeManager')}
                      </Button>
                    )}
                  </div>
              </div>
              )}
            </CardContent>
              </>
            )}
            {!selectedRoute && (
              <CardContent>
                <div className="py-12">
                  <div className="text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('noRouteSelectedDesc')}
                    </p>
                    {!showRouteManager && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="btn-primary"
                        onClick={() => handlePanelToggle('route-manager')}
                        title="Show route manager"
                      >
                        <FolderOpen className="w-4 h-4 mr-2" />
                        {t('routeManager')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
          </div>

              {/* Route Manager Panel */}
              {showRouteManager && (
                <div className="lg:w-1/3 lg:order-2">
                  <Card className="shadow-mountain-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('routeManager')}</CardTitle>
                  <CardDescription>{t('manageRoutes')}</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="btn-close"
                  onClick={() => handlePanelToggle('route-manager')}
                  title="Close panel"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Route List */}
              {routes.length > 0 && (
                  <div className="space-y-2">
                  <h3 className="text-sm font-semibold">{t('savedRoutes')}</h3>
                  {routes.map(route => (
                    <div
                      key={route.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedRoute?.id === route.id
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card border-border hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedRoute(route)}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm font-medium truncate">{route.name}</span>
                      </div>
                      <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                          className={routeConfirmingDelete === route.id ? "btn-danger bg-red-100 border-red-300" : "btn-danger"}
                        onClick={(e) => {
                          e.stopPropagation()
                            handleDeleteRouteClick(route.id)
                        }}
                      >
                          <Trash2 className="w-4 h-4" />
                      </Button>
                        {routeConfirmingDelete === route.id && (
                          <div className="absolute right-0 top-0 -translate-y-full -translate-x-2 mb-2 p-4 bg-white border border-gray-200 text-gray-700 text-xs rounded-lg shadow-lg z-10 w-64">
                            <div className="whitespace-normal mb-3">
                              {t('deleteRouteMessage')}
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  cancelDeleteRoute()
                                }}
                              >
                                {t('cancel')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs btn-danger"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  confirmDeleteRoute(route.id)
                                }}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                {t('deleteRoute')}
                              </Button>
                            </div>
                            <div className="absolute top-full right-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
                            <div className="absolute top-full right-6 -mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

                {routes.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">{t('noRoutes')}</p>
                </div>
              )}

              {/* Add Route Section */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-3">{t('addRouteTitle')}</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  {t('gpxFileExplanation')}
                </p>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 hover:border-primary hover:bg-gray-50 ${
                    isDragOver ? 'border-primary bg-gray-50' : 'border-border'
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <Upload className={`w-12 h-12 mx-auto mb-3 transition-colors ${
                    isDragOver ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <h4 className={`text-sm font-semibold mb-2 transition-colors ${
                    isDragOver ? 'text-primary' : ''
                  }`}>
                    {isDragOver ? t('dropGPXFileHere') : t('uploadGPXFile')}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t('dragDropZone')}
                  </p>
                  <label htmlFor="gpx-upload-panel">
                    <Button variant="outline" size="sm" className="btn-primary" asChild>
                      <div className="cursor-pointer">
                        <Upload className="w-3 h-3 mr-2" />
                        {t('selectFile')}
                      </div>
                    </Button>
                    <Input
                      id="gpx-upload-panel"
                      type="file"
                      accept=".gpx"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
                </div>
              )}

              {/* General Settings Panel */}
              {showSettings && (
                <div className="lg:w-1/3 lg:order-2">
                  <Card className="shadow-mountain-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('generalSettings')}</CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="btn-close"
                  onClick={() => handlePanelToggle('general-settings')}
                  title="Close panel"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* App Settings */}
                <div className="settings-section">
                  <h3 className="settings-section-title">{t('appSettings')}</h3>
                  <div className="space-y-4">
                  <div>
                  <label className="text-sm font-medium mb-2 block">{t('language')}</label>
                  <div className="relative">
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="appearance-none bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent w-full"
                      title="Select language"
                    >
                      {Object.entries(languages).map(([code, lang]) => (
                        <option key={code} value={code}>
                          {lang.flag} {lang.name}
                        </option>
                      ))}
                    </select>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 pt-2 border-t border-border">
                      <input
                        type="checkbox"
                        id="suppress-waypoint-warning"
                        checked={settings.suppressWaypointModificationWarning || false}
                        onChange={(e) => {
                          const newSettings = { ...settings, suppressWaypointModificationWarning: e.target.checked };
                          setSettings(newSettings);
                          localStorage.setItem('mountainSettings', JSON.stringify(newSettings));
                        }}
                        className="w-4 h-4"
                      />
                      <label
                        htmlFor="suppress-waypoint-warning"
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {t('suppressWaypointModificationWarning')}
                      </label>
                  </div>
                </div>
                    </div>

                {/* Default Route Settings */}
                <div className="settings-section">
                  <h3 className="settings-section-title">{t('defaultRouteConfiguration')}</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t('defaultValuesExplanation')}
                  </p>
                  
                  {/* Start Time */}
                  <div className="mb-4">
                          <label className="text-sm font-medium">{t('startTime')}</label>
                            <Input
                            type="time"
                            value={settings.startTime}
                            onChange={(e) => updateDefaultSettings('startTime', e.target.value)}
                      className="settings-input"
                          />
                        </div>

                  {/* Safety Time */}
                  <div className="mb-4">
                    <label className="text-sm font-medium">{t('safetyTime')}</label>
                    <Input
                      type="number"
                      value={settings.safetyTimePercentage}
                      onChange={(e) => updateDefaultSettings('safetyTimePercentage', parseFloat(e.target.value) || 0)}
                      step="1"
                      min="0"
                      max="100"
                      className="settings-input"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('additionalTimeBuffer')}
                    </p>
                  </div>

                  {/* Distance Calculation Method */}
                  <div className="mb-4">
                          <label className="text-sm font-medium">{t('distanceCalculation')}</label>
                          <select
                            value={settings.distanceCalculationMethod}
                            onChange={(e) => updateDefaultSettings('distanceCalculationMethod', e.target.value)}
                            className="mt-1 w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                          >
                            <option value="track">{t('trackBased')}</option>
                            <option value="waypoint-to-waypoint">{t('waypointToWaypoint')}</option>
                          </select>
                          <p className="text-xs text-muted-foreground mt-1">
                            {settings.distanceCalculationMethod === 'track' 
                              ? 'Uses actual track path for accurate distances'
                              : 'Uses straight-line distance between waypoints'
                            }
                          </p>
                        </div>

                  {/* Activity Mode and Speed Settings */}
                        <div>
                    <h4 className="text-sm font-medium mb-4">{t('speeds')}</h4>
                    
                    {/* Activity Mode Selector */}
                    <div className="mb-4">
                      <div className="relative">
                        <select
                          value={settings.activityMode}
                          onChange={(e) => updateDefaultSettings('activityMode', e.target.value)}
                          className="appearance-none bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent w-full"
                          title="Select activity mode"
                        >
                          <option value="hiking">🥾 {t('hiking')}</option>
                          <option value="snowshoes">❄️ {t('snowshoes')}</option>
                          <option value="skiTouring">🎿 {t('skiTouring')}</option>
                        </select>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Default speeds for new routes (m/h)
                      </p>
                    </div>
                    
                    {/* Speed Settings in 3 columns */}
                    <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="text-xs text-muted-foreground">Ascent</label>
                          <Input
                            type="number"
                        value={getCurrentSpeeds().ascentSpeed}
                        onChange={(e) => updateDefaultSettings('ascentSpeed', parseFloat(e.target.value))}
                        step="10"
                        className="settings-input"
                      />
                        </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Descent</label>
                      <Input
                        type="number"
                        value={getCurrentSpeeds().descentSpeed}
                        onChange={(e) => updateDefaultSettings('descentSpeed', parseFloat(e.target.value))}
                        step="10"
                        className="settings-input"
                      />
                  </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Flat</label>
                      <Input
                        type="number"
                        value={getCurrentSpeeds().flatSpeed}
                        onChange={(e) => updateDefaultSettings('flatSpeed', parseFloat(e.target.value))}
                        step="100"
                        className="settings-input"
                      />
                    </div>
                    </div>
                  </div>
                </div>
                
                {/* Clean All Data Button */}
                <div className="pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    className="w-full btn-danger"
                    onClick={() => setShowCleanDataDialog(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('cleanAllData')}
                  </Button>
                </div>
              </CardContent>
                  </Card>
                </div>
              )}

              {/* Route Settings Panel */}
              {showRouteSettings && selectedRoute && (
                <div className="lg:w-1/3 lg:order-2">
                  <Card className="shadow-mountain-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('routeConfiguration')}</CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="btn-close"
                    onClick={() => handlePanelToggle('route-settings')}
                    title="Close panel"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Route Settings */}
                <div className="settings-section">
                  
                  {/* Start Time and Safety Time - Side by Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    {/* Start Time */}
                    <div>
                      <label className="text-sm font-medium">{t('startTime')}</label>
                      <Input
                        type="time"
                        value={getEffectiveSettings(selectedRoute).startTime}
                        onChange={(e) => updateRouteSettings('startTime', e.target.value)}
                        className="settings-input"
                      />
                    </div>

                    {/* Safety Time */}
                    <div>
                      <label className="text-sm font-medium">{t('safetyTimeLabel')}</label>
                      <Input
                        type="number"
                        value={getEffectiveSettings(selectedRoute).safetyTimePercentage}
                        onChange={(e) => updateRouteSettings('safetyTimePercentage', parseFloat(e.target.value) || 0)}
                        step="1"
                        min="0"
                        max="100"
                        className="settings-input"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Additional time buffer as percentage of total route time
                      </p>
                    </div>
                  </div>

                  {/* Distance Calculation Method */}
                  <div className="mb-4">
                    <label className="text-sm font-medium">{t('distanceCalculation')}</label>
                    <select
                      value={getEffectiveSettings(selectedRoute).distanceCalculationMethod}
                      onChange={(e) => updateRouteSettings('distanceCalculationMethod', e.target.value)}
                      className="settings-input w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                    >
                      <option value="track">{t('trackBased')}</option>
                      <option value="waypoint-to-waypoint">{t('waypointToWaypoint')}</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getEffectiveSettings(selectedRoute).distanceCalculationMethod === 'track' 
                        ? t('trackBasedDesc')
                        : t('waypointToWaypointDesc')
                      }
                    </p>
                </div>
                
                  {/* Activity Mode and Speed Settings */}
                <div>
                    <h4 className="text-sm font-medium mb-4">{t('speeds')}</h4>
                  
                  {/* Activity Mode Selector */}
                  <div className="mb-4">
                    <div className="relative">
                      <select
                        value={getEffectiveSettings(selectedRoute).activityMode || settings.activityMode}
                        onChange={(e) => {
                          const currentMode = getEffectiveSettings(selectedRoute).activityMode || settings.activityMode
                          if (e.target.value !== currentMode) {
                            handleActivityModeChange(e.target.value)
                          }
                        }}
                        className="appearance-none bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent w-full"
                        title="Select activity mode for this route"
                      >
                        <option value="hiking">🥾 {t('hiking')}</option>
                        <option value="snowshoes">❄️ {t('snowshoes')}</option>
                        <option value="skiTouring">🎿 {t('skiTouring')}</option>
                      </select>
                      {activityModeChangePending && (
                        <div className="absolute left-0 top-0 -translate-y-full -translate-x-2 mb-2 p-4 bg-white border border-gray-200 text-gray-700 text-xs rounded-lg shadow-lg z-10 w-80">
                          <div className="whitespace-normal mb-3">
                            {t('activityModeChangeMessage')}
                      </div>
                          <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                              className="h-6 px-2 text-xs bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                              onClick={(e) => {
                                e.stopPropagation()
                                cancelActivityModeChange()
                              }}
                            >
                              {t('cancel')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs btn-primary"
                              onClick={(e) => {
                                e.stopPropagation()
                                confirmActivityModeChange()
                              }}
                            >
                              <span className="mr-1">✅</span>
                              {t('confirmActivityModeChange')}
                  </Button>
                    </div>
                          <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
                          <div className="absolute top-full left-6 -mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200"></div>
                      </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Speeds for this route (m/h)
                    </p>
                      </div>
                  
                  {/* Speed Settings in 3 columns */}
                  <div className="grid grid-cols-3 gap-3">
                        <div>
                      <label className="text-xs text-muted-foreground">Ascent</label>
                    <Input
                      type="number"
                      value={getEffectiveSettings(selectedRoute).ascentSpeed}
                      onChange={(e) => updateRouteSettings('ascentSpeed', parseFloat(e.target.value))}
                      step="10"
                      className="settings-input"
                    />
                        </div>
                        <div>
                      <label className="text-xs text-muted-foreground">Descent</label>
                    <Input
                      type="number"
                      value={getEffectiveSettings(selectedRoute).descentSpeed}
                      onChange={(e) => updateRouteSettings('descentSpeed', parseFloat(e.target.value))}
                      step="10"
                      className="settings-input"
                    />
                        </div>
                        <div>
                      <label className="text-xs text-muted-foreground">Flat</label>
                    <Input
                      type="number"
                      value={getEffectiveSettings(selectedRoute).flatSpeed}
                      onChange={(e) => updateRouteSettings('flatSpeed', parseFloat(e.target.value))}
                      step="100"
                      className="settings-input"
                    />
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-3">
                          {t('segmentTimeFormula')}
                        </p>
                  </div>
                </div>
                
                {/* Route Log Section */}
                {selectedRoute && (
                <div className="pt-4 border-t border-border">
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Route Activity Log
                    </h3>
                    {selectedRoute.log && selectedRoute.log.length > 0 ? (
                      <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                        {selectedRoute.log.map((logEntry, index) => {
                          const date = new Date(logEntry.timestamp);
                          const formattedDate = date.toLocaleDateString();
                          const formattedTime = date.toLocaleTimeString();
                          
                          let icon, bgColor, textColor, borderColor;
                          switch (logEntry.type) {
                            case 'warning':
                              icon = <AlertTriangle className="w-4 h-4" />;
                              bgColor = 'bg-yellow-50 dark:bg-yellow-900/20';
                              textColor = 'text-yellow-800 dark:text-yellow-200';
                              borderColor = 'border-yellow-200 dark:border-yellow-800';
                              break;
                            case 'error':
                            case 'danger':
                              icon = <AlertCircle className="w-4 h-4" />;
                              bgColor = 'bg-red-50 dark:bg-red-900/20';
                              textColor = 'text-red-800 dark:text-red-200';
                              borderColor = 'border-red-200 dark:border-red-800';
                              break;
                            default:
                              icon = <Info className="w-4 h-4" />;
                              bgColor = 'bg-blue-50 dark:bg-blue-900/20';
                              textColor = 'text-blue-800 dark:text-blue-200';
                              borderColor = 'border-blue-200 dark:border-blue-800';
                          }
                          
                          return (
                            <div
                              key={index}
                              className={`p-3 rounded-lg border ${bgColor} ${borderColor} ${textColor} text-sm`}
                            >
                              <div className="flex items-start gap-2 mb-1">
                                <div className="mt-0.5">{icon}</div>
                                <div className="flex-1">
                                  <div className="font-medium">{logEntry.message}</div>
                                  <div className="text-xs opacity-75 mt-1">
                                    {formattedDate} at {formattedTime}
                                  </div>
                                  {logEntry.waypointName && (
                                    <div className="text-xs mt-1 flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      Waypoint: {logEntry.waypointName}
                                      {logEntry.oldName && (
                                        <span className="ml-1 text-muted-foreground">
                                          (was: {logEntry.oldName})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {logEntry.waypointCount !== undefined && (
                                    <div className="text-xs mt-1">
                                      {logEntry.waypointCount} waypoint(s) detected
                                    </div>
                                  )}
                                  {logEntry.trackCount !== undefined && (
                                    <div className="text-xs mt-1">
                                      Track: {logEntry.trackName || 'Unnamed'}, {logEntry.trackPointCount} points
                                    </div>
                                  )}
                                  {logEntry.action && (
                                    <div className="text-xs mt-1 italic">
                                      Action: {logEntry.action}
                                    </div>
                                  )}
                                  {logEntry.fallback && (
                                    <div className="text-xs mt-1 italic">
                                      {logEntry.fallback}
                                    </div>
                                  )}
                                  {logEntry.latitude !== undefined && logEntry.longitude !== undefined && (
                                    <div className="text-xs mt-1">
                                      Location: {logEntry.latitude.toFixed(6)}, {logEntry.longitude.toFixed(6)}
                                    </div>
                                  )}
                                  {logEntry.elevation !== undefined && (
                                    <div className="text-xs mt-1">
                                      Elevation: {logEntry.elevation.toFixed(0)} m
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No activity log entries yet
                      </p>
                    )}
                  </div>
                )}
                
                {/* Exports Section */}
                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold mb-4 text-foreground">{t('exports')}</h3>
                  <div className="space-y-4">
                    {/* GPX Export */}
                    <div className="group relative p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                            <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-medium text-foreground">{t('exportGPX')}</h4>
                              {selectedRoute && (() => {
                                const modifications = checkWaypointModifications(selectedRoute);
                                if (modifications.modified) {
                                  const totalModifications = modifications.added + modifications.removed + modifications.renamed;
                                  return (
                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800">
                                      {totalModifications}
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {t('exportGPXDesc')}
                            </p>
                            {selectedRoute && (() => {
                              const modifications = checkWaypointModifications(selectedRoute);
                              if (modifications.modified) {
                                const modificationDetails = [];
                                if (modifications.added > 0) modificationDetails.push(`${modifications.added} ${t('added')}`);
                                if (modifications.removed > 0) modificationDetails.push(`${modifications.removed} ${t('removed')}`);
                                if (modifications.renamed > 0) modificationDetails.push(`${modifications.renamed} ${t('renamed')}`);
                                return (
                                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1.5 font-medium">
                                    {modificationDetails.join(', ')}
                                  </p>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-shrink-0"
                          onClick={handleExportGPX}
                          disabled={!selectedRoute}
                        >
                          <FileDown className="w-4 h-4 mr-1.5" />
                          {t('export')}
                        </Button>
                      </div>
                    </div>
                    
                    {/* PDF Export */}
                    <div className="group relative p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-foreground mb-1">{t('exportPDF')}</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {t('exportPDFDesc')}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-shrink-0"
                          onClick={handleExportPDF}
                          disabled={!selectedRoute}
                        >
                          <FileDown className="w-4 h-4 mr-1.5" />
                          {t('export')}
                        </Button>
                      </div>
                    </div>
                    
                    {/* CSV Export */}
                    <div className="group relative p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                            <FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-foreground mb-1">{t('exportCSV')}</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {t('exportCSVDesc')}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-shrink-0"
                          onClick={handleExportCSV}
                          disabled={!selectedRoute}
                        >
                          <FileDown className="w-4 h-4 mr-1.5" />
                          {t('export')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

              {/* Help Panel */}
              {showHelp && (
                <div className="lg:w-1/3 lg:order-2">
                  <Card className="shadow-mountain-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{t('help')}</CardTitle>
                          <CardDescription>
                            {t('technicalDetailsDesc')}
                          </CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="btn-close"
                          onClick={() => handlePanelToggle('help')}
                          title="Close panel"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* How It Works */}
                        <div>
                          <h4 className="text-sm font-semibold mb-3">{t('howItWorks')}</h4>
                          <div className="space-y-3 text-sm text-muted-foreground">
                            <p>
                              {t('howItWorksDesc')}{' '}
                              <a 
                                href="https://gpx.studio" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline font-medium"
                              >
                                https://gpx.studio
                              </a>
                              {' '}{t('howItWorksDesc2')}
                            </p>
                            
                            <div className="pt-2 border-t border-border">
                              <p className="font-medium text-foreground mb-2">{t('whatIsGPX')}</p>
                              <p className="text-xs">{t('whatIsGPXDesc')}</p>
                            </div>
                            
                            <div className="pt-2 border-t border-border">
                              <p className="font-medium text-foreground mb-2">{t('whatThisToolDoes')}</p>
                              <p className="text-xs mb-2">{t('whatThisToolDoesDesc')}</p>
                              <ul className="text-xs space-y-1 list-disc list-inside pl-2">
                                <li>{t('plannerFeature1')}</li>
                                <li>{t('plannerFeature2')}</li>
                                <li>{t('plannerFeature3')}</li>
                                <li>{t('plannerFeature4')}</li>
                                <li>{t('plannerFeature5')}</li>
                                <li>{t('plannerFeature6')}</li>
                                <li>{t('plannerFeature7')}</li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* Other Tools */}
                        <div>
                          <h4 className="text-sm font-medium mb-3">{t('otherTools')}</h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">{t('otherToolsDesc')}</span>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <a 
                                  href="https://wikiloc.com" 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                                >
                                  {t('wikiloc')}
                                </a>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {t('wikilocDesc')}
                                </div>
                              </div>
                              <div>
                                <a 
                                  href="https://gpx.studio" 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                                >
                                  {t('gpxStudio')}
                                </a>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {t('gpxStudioDesc')}
                                </div>
                              </div>
                              <div>
                                <a 
                                  href="https://www.gpsvisualizer.com/profile_input" 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                                >
                                  {t('gpsVisualizer')}
                                </a>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {t('gpsVisualizerDesc')}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Support */}
                        <div>
                          <h4 className="text-sm font-medium mb-3">{t('support')}</h4>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">{t('reportIssues')}</span>
                            </div>
                            <a 
                              href="https://github.com/Campano/gpx-route-planner/issues" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              {t('githubIssuesPage')}
                            </a>
                          </div>
                        </div>

                        {/* Donate Section */}
                        <div>
                          <h4 className="text-sm font-medium mb-3">{t('donateDesc')}</h4>
                          <div className="space-y-2 text-sm">
                            <p className="text-muted-foreground">
                              {t('donateMessage')}
                            </p>
                            <a 
                              href="https://github.com/sponsors/Campano" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline font-medium"
                            >
                              {t('donate')}
                            </a>
                          </div>
                        </div>

                        {/* About */}
                        <div>
                          <h4 className="text-sm font-medium mb-3">{t('about')}</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('version')}:</span>
                              <span className="font-mono">{packageJson.version}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('built')}:</span>
                              <span className="font-mono">{new Date().toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('author')}:</span>
                              <span className="font-mono">Simón Campano</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('license')}:</span>
                              <a 
                                href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="font-mono text-blue-600 hover:text-blue-800 underline"
                              >
                                CC BY-NC-SA 4.0
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
        </div>
      </div>
      
      {/* Clean All Data Confirmation Dialog */}
      {showCleanDataDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">{t('cleanAllDataConfirm')}</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {t('cleanAllDataMessage')}
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowCleanDataDialog(false)}
                className="bg-gray-50 border-gray-300 text-gray-800 hover:bg-gray-100"
              >
                {t('cancel')}
              </Button>
              <Button
                variant="outline"
                onClick={handleCleanAllData}
                className="btn-danger"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Waypoint Modification Warning Dialog */}
      <AlertDialog open={showWaypointModificationWarning} onOpenChange={(open) => {
        // Prevent closing the dialog by clicking outside or pressing Escape
        // Only allow closing via cancel/confirm buttons
        if (!open) {
          // Allow closing only via our handlers (cancel/confirm buttons)
          return;
        }
        setShowWaypointModificationWarning(open);
      }}>
        <AlertDialogContent
          onPointerDownOutside={(e) => {
            // Prevent closing dialog by clicking outside
            e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            // Prevent closing dialog with Escape key
            e.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              {t('waypointModificationWarning')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>{t('waypointModificationWarningMessage')}</p>
              <p className="text-xs text-muted-foreground">
                {t('waypointModificationWarningSuggestion')}{' '}
                <a 
                  href="https://gpx.studio" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://gpx.studio
                </a>
              </p>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="suppress-warning"
                  checked={suppressWarningCheckbox}
                  onCheckedChange={(checked) => setSuppressWarningCheckbox(checked === true)}
                />
                <label
                  htmlFor="suppress-warning"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {t('doNotShowAnymore')}
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleWaypointModificationCancel}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleWaypointModificationConfirm}>
              {t('continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* No Waypoints Detected Alert */}
      <AlertDialog open={showNoWaypointsAlert} onOpenChange={setShowNoWaypointsAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              {t('noWaypointsDetected')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>{t('noWaypointsDetectedMessage')}</p>
              <p className="text-xs text-muted-foreground">
                {t('noWaypointsDetectedSuggestion')}{' '}
                <a 
                  href="https://gpx.studio" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://gpx.studio
                </a>
                .
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowNoWaypointsAlert(false)}>
              {t('ok')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}

export default App

