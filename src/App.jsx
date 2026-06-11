import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx'
import { Upload, Mountain, Settings2, FileText, Trash2, Download, EyeOff, Home, Edit3, AlertTriangle, X, OctagonPause, Footprints, Snowflake, Zap, Heart, FileSpreadsheet, Info, AlertCircle, Clock, MapPin, FileDown, CircleHelp, Route, Timer, Columns3, Map as MapIcon, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip.jsx'
import { parseGPXFile, recalculateWaypoints, recalculateWaypointGeometry, formatTimeHoursMinutes, formatTimeHoursMinutesForMin, formatTotalTimeWithPercentage } from './lib/calculationService.js'
import { parseGPXGeometry } from './lib/gpxParser.js'
import { exportRouteToPDF } from './lib/pdfExportService.js'
import { exportRouteToGPX, checkWaypointModifications } from './lib/gpxExportService.js'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.jsx'
import { Checkbox } from '@/components/ui/checkbox.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import GitHubCorner from './components/GitHubCorner.jsx'
import RouteMap from './components/RouteMap.jsx'
import RouteElevationChart from './components/RouteElevationChart.jsx'
import { getRouteTrackPoints } from './lib/elevationProfile.js'
import RouteSummaryDescription from './components/RouteSummaryDescription.jsx'
import packageJson from '../package.json'
import { translations, languages } from './lib/translations.js'
import { TIME_CALCULATION_METHODS, DEFAULT_TIME_CALCULATION_METHOD, APP_SETTINGS_STORAGE_KEY, EARTH_RADIUS_METERS, DEG_TO_RAD } from './lib/constants.js'
import {
  getLegDescription as buildLegDescription,
  getPointLabel as buildPointLabel,
} from './lib/waypointUtils.js'
import {
  buildRouteTableRows,
  createRestId,
  getRestLabel,
  getRouteEndTime,
  getRowProgressionPercent,
  getRowTimingMinutes,
  normalizeRouteWaypoints,
  normalizeWaypointRests,
} from './lib/routeTableRows.js'
import {
  DEFAULT_ACTIVITY_MODE,
  DEFAULT_APP_SETTINGS,
  createDefaultRouteSettings,
  getColumnVisibility,
  getRouteViewVisibility,
  getEffectiveRouteSettings,
  getModeSpeeds,
  loadAppSettings,
} from './lib/routeDefaults.js'
import 'leaflet/dist/leaflet.css'
import './App.css'

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

function RouteConfigSection({ title, icon: Icon, children }) {
  return (
    <section className="route-config-section">
      <h3 className="route-config-section__title">
        <Icon className="w-3 h-3 shrink-0 text-muted-foreground" aria-hidden />
        {title}
      </h3>
      <div className="route-config-section__body">{children}</div>
    </section>
  )
}

function RouteExportsPanel({
  selectedRoute,
  t,
  onClose,
  onExportGPX,
  onExportPDF,
  onExportCSV,
}) {
  return (
    <Card className="route-config-panel shadow-mountain-lg text-[11px]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{t('exports')}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="btn-close h-7 w-7"
            onClick={onClose}
            title="Close panel"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="group relative p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-[11px] font-medium text-foreground">{t('exportGPX')}</h4>
                  {selectedRoute && (() => {
                    const modifications = checkWaypointModifications(selectedRoute)
                    if (modifications.modified) {
                      const totalModifications =
                        modifications.added + modifications.removed + modifications.renamed
                      return (
                        <Badge
                          variant="outline"
                          className="h-4 px-1 text-[9px] bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
                        >
                          {totalModifications}
                        </Badge>
                      )
                    }
                    return null
                  })()}
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">{t('exportGPXDesc')}</p>
                {selectedRoute && (() => {
                  const modifications = checkWaypointModifications(selectedRoute)
                  if (modifications.modified) {
                    const modificationDetails = []
                    if (modifications.added > 0)
                      modificationDetails.push(`${modifications.added} ${t('added')}`)
                    if (modifications.removed > 0)
                      modificationDetails.push(`${modifications.removed} ${t('removed')}`)
                    if (modifications.renamed > 0)
                      modificationDetails.push(`${modifications.renamed} ${t('renamed')}`)
                    return (
                      <p className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-1 font-medium">
                        {modificationDetails.join(', ')}
                      </p>
                    )
                  }
                  return null
                })()}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0 h-7 text-[10px] px-2"
              onClick={onExportGPX}
              disabled={!selectedRoute}
            >
              <FileDown className="w-3 h-3 mr-1" />
              {t('export')}
            </Button>
          </div>
        </div>

        <div className="group relative p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[11px] font-medium text-foreground mb-0.5">{t('exportPDF')}</h4>
                <p className="text-[10px] text-muted-foreground leading-snug">{t('exportPDFDesc')}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0 h-7 text-[10px] px-2"
              onClick={onExportPDF}
              disabled={!selectedRoute}
            >
              <FileDown className="w-3 h-3 mr-1" />
              {t('export')}
            </Button>
          </div>
        </div>

        <div className="group relative p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[11px] font-medium text-foreground mb-0.5">{t('exportCSV')}</h4>
                <p className="text-[10px] text-muted-foreground leading-snug">{t('exportCSVDesc')}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0 h-7 text-[10px] px-2"
              onClick={onExportCSV}
              disabled={!selectedRoute}
            >
              <FileDown className="w-3 h-3 mr-1" />
              {t('export')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DistanceFormulaHelpTooltip({ t }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex text-muted-foreground hover:text-foreground"
          aria-label={t('distanceFormulaHelpAria')}
        >
          <CircleHelp className="w-3 h-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[260px] p-3 text-[11px] leading-snug text-left space-y-2.5"
      >
        <div>
          <p className="font-semibold text-xs mb-0.5">{t('trackBased')}</p>
          <p className="opacity-95">{t('trackBasedDesc')}</p>
        </div>
        <div className="border-t border-white/20 pt-2">
          <p className="font-semibold text-xs mb-0.5">{t('waypointToWaypoint')}</p>
          <p className="opacity-95">{t('waypointToWaypointDesc')}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function TimeFormulaHelpTooltip({ t }) {
  const formulaCodeClass =
    'mt-1 rounded bg-black/25 px-2 py-1.5 font-mono text-[10px] leading-relaxed whitespace-pre-wrap border border-white/10'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex text-muted-foreground hover:text-foreground"
          aria-label={t('formulaHelpAria')}
        >
          <CircleHelp className="w-3 h-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[300px] p-3 text-[11px] leading-snug text-left space-y-2.5"
      >
        <p className="opacity-90 text-[10px]">{t('timeFormulaHelpIntro')}</p>
        <div>
          <p className="font-semibold text-xs mb-0.5">{t('timeMethodAdditive')}</p>
          <p className="opacity-95">{t('timeMethodAdditiveDesc')}</p>
          <pre className={formulaCodeClass}>{t('segmentTimeFormulaAdditiveCode')}</pre>
        </div>
        <div className="border-t border-white/20 pt-2">
          <p className="font-semibold text-xs mb-0.5">{t('timeMethodActivityBlend')}</p>
          <p className="opacity-95">{t('timeMethodActivityBlendDesc')}</p>
          <pre className={formulaCodeClass}>{t('segmentTimeFormulaActivityBlendCode')}</pre>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function App() {
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [appSettings, setAppSettings] = useState(loadAppSettings)
  const [activePanel, setActivePanel] = useState('home') // 'home', 'route-settings', 'route-exports', null
  const [editingWaypoint, setEditingWaypoint] = useState(null)
  const [editingRouteName, setEditingRouteName] = useState(false)
  const [editingPenalty, setEditingPenalty] = useState(null)
  const [editingRest, setEditingRest] = useState(null)
  const [editingStartTime, setEditingStartTime] = useState(false)
  const [editingSafetyTime, setEditingSafetyTime] = useState(false)
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
  const [showWaypointModificationWarning, setShowWaypointModificationWarning] = useState(false)
  const [waypointModificationAction, setWaypointModificationAction] = useState(null)
  const [suppressWarningCheckbox, setSuppressWarningCheckbox] = useState(false)
  const [showNoWaypointsAlert, setShowNoWaypointsAlert] = useState(false)
  const dragCounterRef = useRef(0)

  // Translation helper
  const t = (key) => {
    return translations[language]?.[key] || translations.en[key] || key
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
  const isHomeView = activePanel === 'home' || !selectedRoute
  const showRouteSettings = activePanel === 'route-settings'
  const showRouteExports = activePanel === 'route-exports'
  const showRouteSidePanel = showRouteSettings || showRouteExports

  const handlePanelToggle = (panelType) => {
    if (panelType === 'home') {
      setActivePanel('home')
      return
    }
    setActivePanel(activePanel === panelType ? null : panelType)
  }

  const openRoute = (route) => {
    setSelectedRoute(route)
    setActivePanel(null)
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

  // Load routes from localStorage on mount
  useEffect(() => {
    const savedRoutes = localStorage.getItem('mountainRoutes')
    
    if (savedRoutes) {
      try {
        const parsedRoutes = JSON.parse(savedRoutes)
        // Ensure all routes have a log array (for backward compatibility)
        const routesWithLog = parsedRoutes.map((route) => {
          const settings = getEffectiveRouteSettings(route)
          let processedTrackPoints = route.processedTrackPoints ?? null
          if (!processedTrackPoints && route.gpxContent) {
            try {
              const geometry = parseGPXGeometry(route.gpxContent, settings)
              processedTrackPoints = geometry.processedTrackPoints ?? null
            } catch {
              processedTrackPoints = null
            }
          }
          const routeForTime = { ...route, processedTrackPoints }
          const waypoints = recalculateWaypoints(
            normalizeRouteWaypoints(route.waypoints || []),
            settings,
            getTimeRecalcOptions(routeForTime, settings),
          )
          return {
            ...route,
            processedTrackPoints,
            log: route.log || [],
            waypoints,
          }
        })
        setRoutes(routesWithLog)
      } catch (error) {
        console.error('Error loading routes from localStorage:', error)
      }
    }
  }, [])

  // Save routes to localStorage whenever they change
  useEffect(() => {
    if (routes.length > 0) {
      localStorage.setItem('mountainRoutes', JSON.stringify(routes))
    }
  }, [routes])


  // Save app preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(appSettings))
  }, [appSettings])

  const getEffectiveSettings = getEffectiveRouteSettings

  const getTimeRecalcOptions = (route) => ({
    processedTrackPoints: route?.processedTrackPoints ?? null,
  })

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
      const defaultRouteSettings = createDefaultRouteSettings()
      const parsed = parseGPXFile(content, defaultRouteSettings)
      
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
        processedTrackPoints: parsed.processedTrackPoints ?? null,
        log: parsed.log || [], // Include log from GPX parsing
        settings: { ...defaultRouteSettings },
        createdAt: Date.now()
      }
      
      setRoutes(prevRoutes => [...prevRoutes, newRoute])
      setSelectedRoute(newRoute)
      setActivePanel(null)
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
    if (isNameModification && !skipWarning && !appSettings.suppressWaypointModificationWarning) {
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
    if (field === 'terrainDifficultyPenalty') {
      const effectiveSettings = getEffectiveSettings(selectedRoute)
      const recalculated = recalculateWaypoints(
        updatedWaypoints,
        effectiveSettings,
        getTimeRecalcOptions(selectedRoute, effectiveSettings),
      )
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

    const normalizedWaypoints = normalizeRouteWaypoints(updatedWaypoints)
    const geometryUpdated = recalculateWaypointGeometry(normalizedWaypoints)
    const effectiveSettings = getEffectiveSettings(selectedRoute)
    const recalculated = recalculateWaypoints(
      geometryUpdated,
      effectiveSettings,
      getTimeRecalcOptions(selectedRoute, effectiveSettings),
    )
    let updatedRouteWithWaypoints = { ...selectedRoute, waypoints: recalculated }
    
    // Add log entry if provided
    if (logEntry) {
      updatedRouteWithWaypoints = addLogEntry(updatedRouteWithWaypoints, logEntry);
    }
    
    const updatedRoute = updateRouteMetadata(updatedRouteWithWaypoints, recalculated)

    setSelectedRoute(updatedRoute)
    setRoutes(prevRoutes => prevRoutes.map((route) => (route.id === updatedRoute.id ? updatedRoute : route)))
  }

  const addRestAtWaypoint = (waypointId) => {
    if (!selectedRoute) return
    const updatedWaypoints = selectedRoute.waypoints.map((wp) => {
      if (wp.id !== waypointId) return wp
      if ((wp.rests ?? []).length > 0) return wp
      return {
        ...wp,
        rests: [{ id: createRestId(), durationMinutes: 15 }],
      }
    })
    applyWaypointChanges(updatedWaypoints)
  }

  const removeRestAtWaypoint = (waypointId, restId) => {
    if (!selectedRoute) return
    const updatedWaypoints = selectedRoute.waypoints.map((wp) =>
      wp.id === waypointId
        ? { ...wp, rests: (wp.rests ?? []).filter((r) => r.id !== restId) }
        : wp,
    )
    applyWaypointChanges(updatedWaypoints)
  }

  const updateRestDuration = (waypointId, restId, durationMinutes) => {
    if (!selectedRoute) return
    const updatedWaypoints = selectedRoute.waypoints.map((wp) => {
      if (wp.id !== waypointId) return wp
      return {
        ...wp,
        rests: (wp.rests ?? []).map((r) =>
          r.id === restId ? { ...r, durationMinutes: Math.max(0, durationMinutes) } : r,
        ),
      }
    })
    applyWaypointChanges(updatedWaypoints)
  }

  const showWaypointModificationWarningIfNeeded = (action) => {
    if (appSettings.suppressWaypointModificationWarning) {
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
      setAppSettings({ ...appSettings, suppressWaypointModificationWarning: true });
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
      const trackPoints = getRouteTrackPoints(selectedRoute) ?? []
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
        rests: [],
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

  const getLegDescription = (waypointIndex) =>
    buildLegDescription(selectedRoute, waypointIndex, t)

  const getPointLabel = (waypoint) => buildPointLabel(selectedRoute, waypoint, t)

  const getVisibleColumns = () =>
    selectedRoute ? getColumnVisibility(getEffectiveSettings(selectedRoute)) : getColumnVisibility({})

  const toggleColumnVisibility = (columnKey) => {
    if (!selectedRoute) return
    const current = getColumnVisibility(getEffectiveSettings(selectedRoute))
    updateRouteSettings('columnVisibility', {
      ...current,
      [columnKey]: !current[columnKey],
    })
  }

  const getRouteView = () =>
    selectedRoute ? getRouteViewVisibility(getEffectiveSettings(selectedRoute)) : getRouteViewVisibility({})

  const toggleRouteViewVisibility = (viewKey) => {
    if (!selectedRoute) return
    const current = getRouteViewVisibility(getEffectiveSettings(selectedRoute))
    updateRouteSettings('routeViewVisibility', {
      ...current,
      [viewKey]: !current[viewKey],
    })
  }

  const visibleColumns = getVisibleColumns()
  const routeView = getRouteView()
  const distanceGroupColSpan =
    (visibleColumns.destinationCoords ? 1 : 0) +
    1 +
    (visibleColumns.routeDistance ? 1 : 0)
  const timingGroupColSpan =
    3 +
    (visibleColumns.totalTime ? 1 : 0) +
    (visibleColumns.progression ? 1 : 0)

  const routeTableRows = selectedRoute ? buildRouteTableRows(selectedRoute.waypoints) : []
  const routeEndTime = selectedRoute ? getRouteEndTime(selectedRoute.waypoints) : 0

  // Delete route
  const deleteRoute = (routeId) => {
    setRoutes(prevRoutes => prevRoutes.filter(r => r.id !== routeId))
    if (selectedRoute?.id === routeId) {
      setSelectedRoute(null)
      setActivePanel('home')
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

  const handleStartTimeChange = (newStartTime) => {
    if (!selectedRoute || !newStartTime) return
    updateRouteSettings('startTime', newStartTime)
  }

  const handleSafetyTimeChange = (value) => {
    if (!selectedRoute) return
    const safetyTimePercentage = Math.max(0, Math.min(100, value))
    updateRouteSettings('safetyTimePercentage', safetyTimePercentage)
  }

  const SETTINGS_REQUIRING_GPX_REPARSE = [
    'distanceCalculationMethod',
    'resampleSpacingM',
    'smoothWindowM',
    'elevationDeadbandM',
  ]

  const mergeLogsAfterReparse = (existingLog, newLog, settingsLogEntry) => {
    const existingLogMap = new globalThis.Map()
    existingLog.forEach((entry) => {
      const key = `${entry.timestamp}-${entry.type}-${entry.message}`
      if (entry.read !== undefined) {
        existingLogMap.set(key, entry.read)
      }
    })
    const combined = settingsLogEntry
      ? [...existingLog, settingsLogEntry, ...newLog]
      : [...existingLog, ...newLog]
    return combined.map((entry) => {
      const key = `${entry.timestamp}-${entry.type}-${entry.message}`
      if (existingLogMap.has(key)) {
        return { ...entry, read: existingLogMap.get(key) }
      }
      return entry
    })
  }

  const mergeWaypointsAfterReparse = (route, parsedWaypoints) =>
    parsedWaypoints.map((newWaypoint, index) => {
      let existingWaypoint = route.waypoints.find(
        (wp) =>
          Math.abs(wp.latitude - newWaypoint.latitude) < 0.0001 &&
          Math.abs(wp.longitude - newWaypoint.longitude) < 0.0001
      )
      if (!existingWaypoint && route.waypoints[index]) {
        existingWaypoint = route.waypoints[index]
      }
      if (existingWaypoint) {
        return {
          ...newWaypoint,
          terrainDifficultyPenalty: existingWaypoint.terrainDifficultyPenalty,
          rests:
            existingWaypoint.rests?.length > 0
              ? existingWaypoint.rests
              : normalizeWaypointRests(existingWaypoint).rests,
          comments: existingWaypoint.comments,
          isDecisionPoint: existingWaypoint.isDecisionPoint,
          id: existingWaypoint.id,
          name:
            existingWaypoint.name &&
            !existingWaypoint.name.match(/^(Waypoint|Point) \d+$/)
              ? existingWaypoint.name
              : newWaypoint.name,
        }
      }
      return newWaypoint
    })

  const reparseRouteFromGpx = (route, newRouteSettings, field, value) => {
    if (!route.gpxContent) {
      alert(t('cannotReparseGpx'))
      return null
    }
    const parsed = parseGPXFile(route.gpxContent, newRouteSettings)
    const settingsLogEntry = createLogEntry('info', 'Route distance settings updated', {
      field,
      value,
      distanceCalculationMethod: newRouteSettings.distanceCalculationMethod,
      resampleSpacingM: newRouteSettings.resampleSpacingM,
      smoothWindowM: newRouteSettings.smoothWindowM,
      elevationDeadbandM: newRouteSettings.elevationDeadbandM,
    })
    const mergedLog = mergeLogsAfterReparse(route.log || [], parsed.log || [], settingsLogEntry)
    const mergedWaypoints = mergeWaypointsAfterReparse(route, parsed.waypoints)
    const recalculatedWaypoints = recalculateWaypoints(
      mergedWaypoints,
      newRouteSettings,
      { processedTrackPoints: parsed.processedTrackPoints ?? null },
    )
    const updatedRouteWithWaypoints = {
      ...route,
      waypoints: recalculatedWaypoints,
      settings: newRouteSettings,
      gpxData: parsed.gpxData,
      processedTrackPoints: parsed.processedTrackPoints ?? null,
      metadata: parsed.metadata,
      log: mergedLog,
    }
    return updateRouteMetadata(updatedRouteWithWaypoints, recalculatedWaypoints)
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
      const newModeSpeeds = getModeSpeeds(value)
      newRouteSettings = {
        ...newRouteSettings,
        ascentSpeed: newModeSpeeds.ascentSpeed,
        descentSpeed: newModeSpeeds.descentSpeed,
        flatSpeed: newModeSpeeds.flatSpeed,
      }
    }
    
    if (SETTINGS_REQUIRING_GPX_REPARSE.includes(field)) {
      try {
        const updatedRoute = reparseRouteFromGpx(selectedRoute, newRouteSettings, field, value)
        if (!updatedRoute) return
        setSelectedRoute(updatedRoute)
        setRoutes((prevRoutes) => prevRoutes.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)))
        return
      } catch (error) {
        console.error('Error re-parsing GPX:', error)
        alert(`${t('errorUpdatingDistanceSettings')}: ${error.message}`)
        return
      }
    }
    
    const updatedRouteWithSettings = { ...selectedRoute, settings: newRouteSettings }
    const recalculated = recalculateWaypoints(
      updatedRouteWithSettings.waypoints,
      newRouteSettings,
      getTimeRecalcOptions(updatedRouteWithSettings, newRouteSettings),
    )
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
    exportRouteToPDF(selectedRoute, language)
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

    const cols = getColumnVisibility(getEffectiveSettings(selectedRoute))

    const headers = [t('originDestination')]
    if (cols.destinationCoords) {
      headers.push('Destination_UTM', 'Destination_Elevation_m')
    }
    headers.push(
      'Segment_Ascent_m',
      'Segment_Descent_m',
      'Segment_Distance_km',
    )
    if (cols.routeDistance) {
      headers.push('Route_Ascent_m', 'Route_Descent_m', 'Route_Distance_km')
    }
    headers.push('Segment_Time', 'Penalty_percent', 'Penalty_Time')
    if (cols.totalTime) {
      headers.push('Total_Time')
    }
    if (cols.progression) {
      headers.push('Progression_percent')
    }
    headers.push(
      t('timeHeader'),
      t('notesHeader'),
      'Decision_Point',
    )

    const csvEndTime = getRouteEndTime(selectedRoute.waypoints)

    const csvData = buildRouteTableRows(selectedRoute.waypoints).map((tableRow) => {
      const isRest = tableRow.rowType === 'rest'
      const wp = tableRow.waypoint
      const index = tableRow.waypointIndex
      const rest = tableRow.rest
      const displayName = isRest
        ? getRestLabel(selectedRoute, wp, t)
        : buildLegDescription(selectedRoute, index, t)
      const penaltyDisplay = `${(wp.terrainDifficultyPenalty * 100).toFixed(0)}%`
      const penaltyTime = wp.terrainDifficultyPenalty > 0
        ? formatTimeHoursMinutesForMin(wp.segmentTime * wp.terrainDifficultyPenalty)
        : ''

      const row = [displayName]
      if (cols.destinationCoords) {
        if (isRest) {
          row.push('', '')
        } else {
          row.push(
            wp.utm ? wp.utm.replace(/^Zone \d+[A-Z] /, '') : 'N/A',
            wp.elevation?.toFixed(0) || '0',
          )
        }
      }
      if (isRest) {
        row.push('', '', '')
      } else {
        row.push(
          index === 0 ? '' : (wp.segmentAscent?.toFixed(0) || '0'),
          index === 0 ? '' : (wp.segmentDescent?.toFixed(0) || '0'),
          index === 0 ? '' : (wp.segmentDistance?.toFixed(2) || '0.00'),
        )
      }
      if (cols.routeDistance) {
        if (isRest) {
          row.push('', '', '')
        } else {
          row.push(
            wp.totalAscent?.toFixed(0) || '0',
            wp.totalDescent?.toFixed(0) || '0',
            wp.totalDistance?.toFixed(2) || '0.00',
          )
        }
      }
      row.push(
        isRest
          ? formatTimeHoursMinutesForMin(rest.durationMinutes || 0)
          : index === 0
            ? ''
            : formatTimeHoursMinutesForMin(wp.segmentTime || 0),
        isRest ? '' : penaltyDisplay,
        isRest ? '' : penaltyTime,
      )
      if (cols.totalTime) {
        row.push(
          formatTimeHoursMinutesForMin(
            isRest ? rest.totalTime || 0 : wp.totalTime || 0,
          ),
        )
      }
      if (cols.progression) {
        row.push(
          isRest
            ? ''
            : `${getRowProgressionPercent(getRowTimingMinutes(tableRow), csvEndTime)}%`,
        )
      }
      row.push(
        isRest ? rest.departureHour || '' : wp.hour || '',
        isRest ? '' : wp.comments || '',
        isRest ? '' : wp.isDecisionPoint ? t('yes') : t('no'),
      )
      return row
    })

    // Add safety time row if there are waypoints
    if (selectedRoute.waypoints.length > 0) {
      const effectiveSettings = getEffectiveSettings(selectedRoute);
      const safetyTime = csvEndTime * (effectiveSettings.safetyTimePercentage / 100);
      const totalWithSafety = csvEndTime + safetyTime;
      
      // Calculate arrival time with safety
      const arrivalTime = calculateArrivalTime(effectiveSettings.startTime || '08:00', totalWithSafety);

      const safetyRow = [`Safety Time (${effectiveSettings.safetyTimePercentage}%)`]
      if (cols.destinationCoords) {
        safetyRow.push('', '')
      }
      safetyRow.push('', '', '')
      if (cols.routeDistance) {
        safetyRow.push('', '', '')
      }
      safetyRow.push(formatTimeHoursMinutesForMin(safetyTime), '', '')
      if (cols.totalTime) {
        safetyRow.push(formatTimeHoursMinutesForMin(totalWithSafety))
      }
      if (cols.progression) {
        safetyRow.push('')
      }
      safetyRow.push(
        arrivalTime,
        '',
        '',
      )
      
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
    
    setAppSettings({ ...DEFAULT_APP_SETTINGS })
    setActivePanel('home')
    
    // Clear localStorage
    localStorage.removeItem('mountainRoutes')
    localStorage.removeItem(APP_SETTINGS_STORAGE_KEY)
    localStorage.removeItem('mountain-route-planner-language')
    
    // Close dialog
    setShowCleanDataDialog(false)
  }

  return (
    <div className="app-shell min-h-screen p-6 relative">
      <GitHubCorner url="https://github.com/Campano/gpx-route-planner/issues" />
      
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
            {!isHomeView && (
              <Button
                variant="outline"
                size="sm"
                className="btn-primary"
                onClick={() => handlePanelToggle('home')}
                title={t('showHome')}
              >
                <Home className="w-4 h-4 mr-2" />
                {t('home')}
              </Button>
            )}
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
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="appearance-none bg-background border border-input rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-w-[7rem]"
              title={t('selectLanguage')}
              aria-label={t('selectLanguage')}
            >
              {Object.entries(languages).map(([code, lang]) => (
                <option key={code} value={code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>


            {/* Home or route view */}
            <div className="flex flex-col-reverse lg:flex-row gap-6 panel-slide-in">
          {isHomeView ? (
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Routes */}
              <Card className="shadow-mountain-lg">
                <CardHeader>
                  <CardTitle>{t('routeManager')}</CardTitle>
                  <CardDescription>{t('manageRoutes')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {routes.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">{t('savedRoutes')}</h3>
                      {routes.map(route => (
                        <div
                          key={route.id}
                          className={`flex items-start justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedRoute?.id === route.id
                              ? 'bg-primary/10 border-primary'
                              : 'bg-card border-border hover:bg-gray-50'
                          }`}
                          onClick={() => openRoute(route)}
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-2">
                            <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                            <div className="min-w-0 space-y-1">
                              <span className="block text-sm font-medium truncate">
                                {route.name || t('unnamedRoute')}
                              </span>
                              <RouteSummaryDescription route={route} t={t} />
                            </div>
                          </div>
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={routeConfirmingDelete === route.id ? 'btn-danger bg-red-100 border-red-300' : 'btn-danger'}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteRouteClick(route.id)
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            {routeConfirmingDelete === route.id && (
                              <div className="absolute right-0 top-0 -translate-y-full -translate-x-2 mb-2 p-4 bg-white border border-gray-200 text-gray-700 text-xs rounded-lg shadow-lg z-10 w-64">
                                <div className="whitespace-normal mb-3">{t('deleteRouteMessage')}</div>
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
                                <div className="absolute top-full right-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white" />
                                <div className="absolute top-full right-6 -mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200" />
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
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold mb-3">{t('addRouteTitle')}</h3>
                    <p className="text-xs text-muted-foreground mb-4">{t('gpxFileExplanation')}</p>
                    <div
                      className={cn('gpx-drop-zone', isDragOver && 'gpx-drop-zone--active')}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      <Upload className="gpx-drop-zone__icon w-12 h-12 mx-auto mb-3 transition-colors" />
                      <h4 className="gpx-drop-zone__title text-sm font-semibold mb-2 transition-colors">
                        {isDragOver ? t('dropGPXFileHere') : t('uploadGPXFile')}
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">{t('dragDropZone')}</p>
                      <label htmlFor="gpx-upload-home">
                        <Button variant="outline" size="sm" className="btn-primary" asChild>
                          <div className="cursor-pointer">
                            <Upload className="w-3 h-3 mr-2" />
                            {t('selectFile')}
                          </div>
                        </Button>
                        <Input
                          id="gpx-upload-home"
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

              {/* Help */}
              <Card className="shadow-mountain-lg">
                <CardHeader>
                  <CardTitle>{t('help')}</CardTitle>
                  <CardDescription>{t('technicalDetailsDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
                    <div>
                      <h4 className="text-sm font-semibold mb-3">{t('howItWorks')}</h4>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <p>
                          {t('howItWorksDesc')}{' '}
                          <a href="https://gpx.studio" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
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
                        <div className="pt-4 border-t border-border">
                          <p className="font-medium text-foreground mb-3">{t('appSettings')}</p>
                          <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="suppress-waypoint-warning-help"
                                checked={appSettings.suppressWaypointModificationWarning || false}
                                onChange={(e) => {
                                  setAppSettings({
                                    ...appSettings,
                                    suppressWaypointModificationWarning: e.target.checked,
                                  })
                                }}
                                className="w-4 h-4"
                              />
                              <label htmlFor="suppress-waypoint-warning-help" className="text-xs font-medium leading-none cursor-pointer">
                                {t('suppressWaypointModificationWarning')}
                              </label>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full btn-danger"
                              onClick={() => setShowCleanDataDialog(true)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t('cleanAllData')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-3">{t('otherTools')}</h4>
                      <div className="space-y-3 text-sm">
                        <div><span className="text-muted-foreground">{t('otherToolsDesc')}</span></div>
                        <div className="space-y-2">
                          <div>
                            <a href="https://wikiloc.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline font-medium">{t('wikiloc')}</a>
                            <div className="text-xs text-muted-foreground mt-1">{t('wikilocDesc')}</div>
                          </div>
                          <div>
                            <a href="https://gpx.studio" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline font-medium">{t('gpxStudio')}</a>
                            <div className="text-xs text-muted-foreground mt-1">{t('gpxStudioDesc')}</div>
                          </div>
                          <div>
                            <a href="https://www.gpsvisualizer.com/profile_input" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline font-medium">{t('gpsVisualizer')}</a>
                            <div className="text-xs text-muted-foreground mt-1">{t('gpsVisualizerDesc')}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-3">{t('support')}</h4>
                      <div className="space-y-2 text-sm">
                        <div><span className="text-muted-foreground">{t('reportIssues')}</span></div>
                        <a href="https://github.com/Campano/gpx-route-planner/issues" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">{t('githubIssuesPage')}</a>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-3">{t('donateDesc')}</h4>
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">{t('donateMessage')}</p>
                        <a href="https://github.com/sponsors/Campano" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline font-medium">{t('donate')}</a>
                      </div>
                    </div>
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
                          <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer" className="font-mono text-blue-600 hover:text-blue-800 underline">CC BY-NC-SA 4.0</a>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
          <>
          {/* Waypoint Table - Main content */}
          <div className={`flex-1 ${showRouteSidePanel ? 'lg:w-2/3' : 'w-full'} ${showRouteSidePanel ? 'lg:order-1' : ''}`}>
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
                      <RouteSummaryDescription route={selectedRoute} t={t} />
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="btn-primary relative"
                        onClick={() => handlePanelToggle('route-exports')}
                        title={showRouteExports ? t('hideExports') : t('showExports')}
                      >
                        {showRouteExports ? (
                          <>
                            <EyeOff className="w-4 h-4 mr-2" />
                            {t('exports')}
                          </>
                        ) : (
                          <>
                            <FileDown className="w-4 h-4 mr-2" />
                            {t('exports')}
                          </>
                        )}
                      </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                  {selectedRoute?.waypoints?.length > 0 && (routeView.map || routeView.elevationGraph) && (
                    <div className="space-y-4">
                      {routeView.map && (
                        <div className="route-map-print h-96 w-full overflow-hidden rounded-lg border border-border">
                          <RouteMap
                            route={selectedRoute}
                            onAddWaypoint={handleAddWaypointAtPosition}
                            onRemoveWaypoint={handleRemoveWaypoint}
                            getWaypointDisplayName={getPointLabel}
                            panelState={activePanel}
                            recenterTitle={t('recenterMapOnTrack')}
                          />
                        </div>
                      )}
                      {routeView.elevationGraph && (
                        <div className="route-elevation-print rounded-lg border border-border bg-card">
                          <div className="border-b border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                            {t('elevationGraph')}
                          </div>
                          <div className="h-56 w-full p-2">
                            <RouteElevationChart
                              route={selectedRoute}
                              getWaypointDisplayName={getPointLabel}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Waypoint Table */}
                <div className="overflow-x-auto route-table-print-wrap">
                  <Table className="route-waypoint-table text-[10px] [&_th]:py-1 [&_td]:py-1 [&_th]:px-1.5 [&_td]:px-1.5">
                    <TableHeader>
                          {/* Group Header Row */}
                          <TableRow>
                            <TableHead rowSpan={2} className="route-table-section-col w-32 min-w-32 text-center bg-muted/50">{t('originDestination')}</TableHead>
                            <TableHead rowSpan={2} className="w-10 min-w-10 text-center bg-muted/50">{t('critical')}</TableHead>
                            <TableHead rowSpan={2} className="route-table-rest-col w-10 min-w-10 text-center bg-muted/50">{t('restColumn')}</TableHead>
                            <TableHead colSpan={distanceGroupColSpan} className="text-center bg-muted/50">{t('distance')}</TableHead>
                            <TableHead colSpan={timingGroupColSpan} className="text-center bg-muted/50">{t('timing')}</TableHead>
                            <TableHead rowSpan={2} className="w-40 min-w-40 max-w-40 text-center bg-muted/50">{t('notes')}</TableHead>
                          </TableRow>
                          {/* Column Header Row */}
                          <TableRow>
                            {visibleColumns.destinationCoords && (
                              <TableHead className="w-32 text-center bg-muted/30">{t('destinationCoords')}</TableHead>
                            )}
                            <TableHead className="w-24 text-center bg-muted/30">{t('segment')}</TableHead>
                            {visibleColumns.routeDistance && (
                              <TableHead className="w-24 text-center bg-muted/30">{t('routeDistance')}</TableHead>
                            )}
                            <TableHead className="w-24 text-center bg-muted/30">{t('segmentTime')}</TableHead>
                            <TableHead className="w-24 text-center bg-muted/30">{t('penalty')}</TableHead>
                            {visibleColumns.totalTime && (
                              <TableHead className="w-24 text-center bg-muted/30">{t('totalTiming')}</TableHead>
                            )}
                            {visibleColumns.progression && (
                              <TableHead className="w-24 text-center bg-muted/30">{t('progression')}</TableHead>
                            )}
                            <TableHead className="w-24 text-center bg-muted/30">{t('time')}</TableHead>
                          </TableRow>
                    </TableHeader>
                    <TableBody>
                      {routeTableRows.map((row, rowIndex) => {
                        const isRest = row.rowType === 'rest'
                        const waypoint = row.waypoint
                        const index = row.waypointIndex
                        const rest = row.rest
                        return (
                        <TableRow
                          key={isRest ? rest.id : waypoint.id}
                          className={
                            isRest
                              ? 'bg-amber-50/80 dark:bg-amber-950/20'
                              : rowIndex % 2 === 0
                                ? 'bg-background'
                                : 'bg-muted/20'
                          }
                        >
                              <TableCell className="route-table-section-col w-32 align-middle">
                                {isRest ? (
                                  <span className="font-medium text-amber-900 dark:text-amber-100 truncate block">
                                    {getRestLabel(selectedRoute, waypoint, t)}
                                  </span>
                                ) : (
                                  <div 
                                    className={`h-7 px-1.5 py-0.5 font-medium rounded border flex items-center group ${
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
                                        className="h-5 text-[10px] px-1"
                                        placeholder={waypoint.isStartPoint ? t('start') : waypoint.isEndPoint ? t('end') : t('waypoint')}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                        onFocus={(e) => e.stopPropagation()}
                                      />
                                    ) : (
                                      <span className="truncate flex-1">{buildLegDescription(selectedRoute, index, t)}</span>
                                    )}
                                    {editingWaypointName !== waypoint.id && !waypoint.isStartPoint && !waypoint.isEndPoint && (
                                      <Edit3 className="route-table-edit-icon w-2.5 h-2.5 ml-1 text-muted-foreground flex-shrink-0" />
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell
                                className={`w-10 text-center align-middle ${
                                  !isRest && waypoint.isDecisionPoint
                                    ? 'bg-red-100 dark:bg-red-950/50'
                                    : ''
                                }`}
                              >
                                {!isRest && (
                                  <input
                                    type="checkbox"
                                    checked={waypoint.isDecisionPoint}
                                    onChange={(e) => updateWaypoint(waypoint.id, 'isDecisionPoint', e.target.checked)}
                                    className="w-3.5 h-3.5"
                                    disabled={waypoint.isStartPoint || waypoint.isEndPoint}
                                    title={t('decisionPoint')}
                                    aria-label={t('decisionPoint')}
                                  />
                                )}
                              </TableCell>
                              <TableCell className="route-table-rest-col w-10 text-center align-middle">
                                {isRest ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    title={t('removeRest')}
                                    onClick={() => removeRestAtWaypoint(waypoint.id, rest.id)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                ) : (
                                  (waypoint.rests ?? []).length === 0 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-amber-800 dark:hover:text-amber-200"
                                      title={t('addRest')}
                                      onClick={() => addRestAtWaypoint(waypoint.id)}
                                    >
                                      <OctagonPause className="w-3.5 h-3.5" />
                                    </Button>
                                  )
                                )}
                              </TableCell>
                              {visibleColumns.destinationCoords && (
                                <TableCell className="w-32">
                                  {isRest ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                  <div className="space-y-0.5 text-center">
                                    <div className="text-muted-foreground">
                                      {waypoint.utm ? waypoint.utm.replace(/^Zone \d+[A-Z] /, '') : 'N/A'}
                                    </div>
                                    <div className="font-medium">
                                        {waypoint.elevation.toFixed(0)}m
                                    </div>
                                  </div>
                                  )}
                                </TableCell>
                              )}
                          <TableCell className="text-center">
                            {isRest ? (
                              <span className="text-muted-foreground">—</span>
                            ) : index === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                            <div className="space-y-1">
                              <div className="text-green-600 font-medium">↑{waypoint.segmentAscent.toFixed(0)}m</div>
                              <div className="text-red-600 font-medium">↓{waypoint.segmentDescent.toFixed(0)}m</div>
                              <div className="text-blue-600 font-medium">{waypoint.segmentDistance.toFixed(2)}km</div>
                            </div>
                            )}
                          </TableCell>
                          {visibleColumns.routeDistance && (
                            <TableCell className="text-center">
                              {isRest ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                              <div className="space-y-0.5">
                                <div className="text-green-600 font-medium">↑{waypoint.totalAscent.toFixed(0)}m</div>
                                <div className="text-red-600 font-medium">↓{waypoint.totalDescent.toFixed(0)}m</div>
                                <div className="text-blue-600 font-medium">{waypoint.totalDistance.toFixed(2)}km</div>
                              </div>
                              )}
                            </TableCell>
                          )}
                          <TableCell
                            className={`text-center ${isRest ? 'group cursor-pointer' : ''}`}
                            onClick={() => isRest && editingRest !== rest.id && setEditingRest(rest.id)}
                          >
                            {isRest ? (
                              editingRest === rest.id ? (
                                <Input
                                  type="number"
                                  value={rest.durationMinutes}
                                  onChange={(e) => updateRestDuration(waypoint.id, rest.id, parseFloat(e.target.value) || 0)}
                                  onBlur={() => setEditingRest(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === 'Escape') {
                                      setEditingRest(null)
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-6 text-[10px] w-16 text-center mx-auto"
                                  min={0}
                                  step={1}
                                  autoFocus
                                />
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <span>{formatTimeHoursMinutesForMin(rest.durationMinutes)}</span>
                                  <Edit3 className="route-table-edit-icon w-3 h-3 text-muted-foreground flex-shrink-0" />
                                </div>
                              )
                            ) : index === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              formatTimeHoursMinutesForMin(waypoint.segmentTime)
                            )}
                          </TableCell>
                          <TableCell 
                            className="penalty-cell group"
                            onClick={() => !isRest && editingPenalty !== waypoint.id && setEditingPenalty(waypoint.id)}
                          >
                            {isRest || index === 0 ? (
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
                              className="h-6 text-[10px] w-16 text-center"
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <span className="penalty-text">
                                  {(waypoint.terrainDifficultyPenalty * 100).toFixed(0)}%
                                  {waypoint.terrainDifficultyPenalty > 0 && (
                                    <span className="text-muted-foreground">
                                      {' '}({formatTimeHoursMinutesForMin(waypoint.segmentTime * waypoint.terrainDifficultyPenalty)})
                                    </span>
                                  )}
                                </span>
                                <Edit3 className="route-table-edit-icon w-3 h-3 text-muted-foreground penalty-icon flex-shrink-0" />
                              </div>
                            )}
                          </TableCell>
                          {visibleColumns.totalTime && (
                            <TableCell className="text-center">
                              {isRest
                                ? formatTimeHoursMinutesForMin(rest.totalTime)
                                : formatTimeHoursMinutesForMin(waypoint.totalTime)}
                            </TableCell>
                          )}
                          {visibleColumns.progression && (
                            <TableCell className="text-center">
                              {isRest ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                `${getRowProgressionPercent(getRowTimingMinutes(row), routeEndTime)}%`
                              )}
                            </TableCell>
                          )}
                          <TableCell
                            className={`text-center ${!isRest && index === 0 ? 'group cursor-pointer' : ''}`}
                            onClick={() => !isRest && index === 0 && !editingStartTime && setEditingStartTime(true)}
                          >
                            {isRest ? (
                              <span>{rest.departureHour}</span>
                            ) : index === 0 ? (
                              editingStartTime ? (
                                <Input
                                  type="time"
                                  value={getEffectiveSettings(selectedRoute).startTime}
                                  onChange={(e) => handleStartTimeChange(e.target.value)}
                                  onBlur={() => setEditingStartTime(false)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === 'Escape') {
                                      setEditingStartTime(false)
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-6 text-[10px] w-24 text-center mx-auto"
                                  autoFocus
                                />
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <span>{waypoint.hour}</span>
                                  <Edit3 className="route-table-edit-icon w-3 h-3 text-muted-foreground flex-shrink-0" />
                                </div>
                              )
                            ) : (
                              waypoint.hour
                            )}
                          </TableCell>
                          <TableCell 
                            className="w-40 min-w-40 max-w-40 note-cell group"
                            onClick={() => !isRest && editingWaypoint !== waypoint.id && setEditingWaypoint(waypoint.id)}
                          >
                            {isRest ? null : editingWaypoint === waypoint.id ? (
                              <Textarea
                                value={waypoint.comments}
                                onChange={(e) => updateWaypoint(waypoint.id, 'comments', e.target.value)}
                                className="min-h-6 text-[10px] resize-none w-full"
                                placeholder="Notes..."
                                rows={3}
                                onBlur={() => setEditingWaypoint(null)}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-start gap-2 w-full">
                                <div className="flex-1 break-words whitespace-pre-wrap break-all note-text">
                                  {waypoint.comments || (
                                    <span className="text-muted-foreground italic note-placeholder">No notes</span>
                                  )}
                                </div>
                                <Edit3 className="route-table-edit-icon w-3 h-3 text-muted-foreground note-icon flex-shrink-0" />
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                        )
                      })}
                          
                          {/* Safety Time Row */}
                          {selectedRoute.waypoints.length > 0 && (
                            <TableRow className="bg-muted/20 font-medium">
                              <TableCell
                                className="route-table-section-col w-32 text-center font-medium group cursor-pointer"
                                onClick={() => !editingSafetyTime && setEditingSafetyTime(true)}
                              >
                                {editingSafetyTime ? (
                                  <div className="space-y-0.5">
                                    <div>{t('safetyTime')}</div>
                                    <div className="flex items-center justify-center gap-1">
                                      <Input
                                        type="number"
                                        value={getEffectiveSettings(selectedRoute).safetyTimePercentage}
                                        onChange={(e) => handleSafetyTimeChange(parseFloat(e.target.value) || 0)}
                                        onBlur={() => setEditingSafetyTime(false)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === 'Escape') {
                                            setEditingSafetyTime(false)
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-6 text-[10px] w-14 text-center"
                                        min={0}
                                        max={100}
                                        step={1}
                                        autoFocus
                                      />
                                      <span>%</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-0.5">
                                    <div>{t('safetyTime')}</div>
                                    <div className="flex items-center justify-center gap-1">
                                      <span>{getEffectiveSettings(selectedRoute).safetyTimePercentage}%</span>
                                      <Edit3 className="route-table-edit-icon w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="w-10" />
                              <TableCell className="route-table-rest-col w-10" />
                              {visibleColumns.destinationCoords && (
                                <TableCell className="w-32"></TableCell>
                              )}
                              <TableCell></TableCell>
                              {visibleColumns.routeDistance && (
                                <TableCell></TableCell>
                              )}
                              {/* Timing Columns - Show Safety Time */}
                              <TableCell className="text-center font-medium">
                                {formatTimeHoursMinutesForMin(
                                  routeEndTime * (getEffectiveSettings(selectedRoute).safetyTimePercentage / 100),
                                )}
                              </TableCell>
                              <TableCell></TableCell>
                              {visibleColumns.totalTime && (
                                <TableCell className="text-center font-medium">
                                  {formatTimeHoursMinutesForMin(
                                    routeEndTime + routeEndTime * (getEffectiveSettings(selectedRoute).safetyTimePercentage / 100),
                                  )}
                                </TableCell>
                              )}
                              {visibleColumns.progression && (
                                <TableCell></TableCell>
                              )}
                              <TableCell className="text-center font-medium">
                                {calculateArrivalTime(
                                  getEffectiveSettings(selectedRoute).startTime,
                                  routeEndTime + routeEndTime * (getEffectiveSettings(selectedRoute).safetyTimePercentage / 100),
                                )}
                              </TableCell>
                              {/* Notes Column - Empty */}
                              <TableCell></TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                </div>
                </div>
            </CardContent>
              </>
            )}
          </Card>
          </div>

              {/* Route Settings Panel */}
              {showRouteSettings && selectedRoute && (
                <div className="lg:w-1/3 lg:order-2">
                  <Card className="route-config-panel shadow-mountain-lg text-[11px]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">{t('routeConfiguration')}</CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="btn-close h-7 w-7"
                    onClick={() => handlePanelToggle('route-settings')}
                    title="Close panel"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="route-config-panel__content">
                <RouteConfigSection title={t('trackPreProcessing')} icon={Layers}>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="flex items-center gap-0.5 min-h-[14px]">
                        <label className="text-[10px] font-medium leading-none">{t('resampling')}</label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex text-muted-foreground hover:text-foreground"
                              aria-label={t('resampleSpacingTip')}
                            >
                              <CircleHelp className="w-3 h-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px] text-[11px] leading-snug">
                            {t('resampleSpacingTip')}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        step={1}
                        value={getEffectiveSettings(selectedRoute).resampleSpacingM ?? 3}
                        onChange={(e) =>
                          updateRouteSettings('resampleSpacingM', parseFloat(e.target.value) || 3)
                        }
                        className="settings-input"
                        title={t('resampleSpacing')}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-0.5 min-h-[14px]">
                        <label className="text-[10px] font-medium leading-none">{t('smoothing')}</label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex text-muted-foreground hover:text-foreground"
                              aria-label={t('smoothWindowTip')}
                            >
                              <CircleHelp className="w-3 h-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px] text-[11px] leading-snug">
                            {t('smoothWindowTip')}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={200}
                        step={1}
                        value={getEffectiveSettings(selectedRoute).smoothWindowM ?? 15}
                        onChange={(e) =>
                          updateRouteSettings('smoothWindowM', parseFloat(e.target.value) || 15)
                        }
                        className="settings-input"
                        title={t('smoothWindow')}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-0.5 min-h-[14px]">
                        <label className="text-[10px] font-medium leading-none">{t('deadband')}</label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex text-muted-foreground hover:text-foreground"
                              aria-label={t('elevationDeadbandTip')}
                            >
                              <CircleHelp className="w-3 h-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px] text-[11px] leading-snug">
                            {t('elevationDeadbandTip')}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={20}
                        step={0.5}
                        value={getEffectiveSettings(selectedRoute).elevationDeadbandM ?? 2}
                        onChange={(e) =>
                          updateRouteSettings('elevationDeadbandM', parseFloat(e.target.value) || 0)
                        }
                        className="settings-input"
                        title={t('elevationDeadband')}
                      />
                    </div>
                  </div>
                </RouteConfigSection>

                <RouteConfigSection title={t('distanceCalculation')} icon={Route}>
                  <div>
                    <div className="flex items-center gap-0.5 mb-0.5">
                      <label className="text-[10px] font-medium leading-none">{t('formula')}</label>
                      <DistanceFormulaHelpTooltip t={t} />
                    </div>
                    <select
                      value={getEffectiveSettings(selectedRoute).distanceCalculationMethod}
                      onChange={(e) => updateRouteSettings('distanceCalculationMethod', e.target.value)}
                      className="settings-input w-full border border-input bg-background rounded-md"
                    >
                      <option value="track">{t('trackBased')}</option>
                      <option value="waypoint-to-waypoint">{t('waypointToWaypoint')}</option>
                    </select>
                  </div>
                </RouteConfigSection>

                <RouteConfigSection title={t('timeCalculation')} icon={Timer}>
                  <div>
                    <div className="flex items-center gap-0.5 mb-0.5">
                      <label className="text-[10px] font-medium leading-none">{t('formula')}</label>
                      <TimeFormulaHelpTooltip t={t} />
                    </div>
                    <select
                      value={
                        getEffectiveSettings(selectedRoute).timeCalculationMethod ??
                        DEFAULT_TIME_CALCULATION_METHOD
                      }
                      onChange={(e) => updateRouteSettings('timeCalculationMethod', e.target.value)}
                      className="settings-input w-full border border-input bg-background rounded-md"
                    >
                      <option value={TIME_CALCULATION_METHODS.ADDITIVE}>{t('timeMethodAdditive')}</option>
                      <option value={TIME_CALCULATION_METHODS.ACTIVITY_BLEND}>
                        {t('timeMethodActivityBlend')}
                      </option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-0.5">
                      <label className="text-[10px] font-medium leading-none">{t('activitySpeed')}</label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex text-muted-foreground hover:text-foreground"
                            aria-label={t('activitySpeedDesc')}
                          >
                            <CircleHelp className="w-3 h-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px] text-[11px] leading-snug">
                          {t('activitySpeedDesc')}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <select
                      value={getEffectiveSettings(selectedRoute).activityMode || DEFAULT_ACTIVITY_MODE}
                      onChange={(e) => {
                        const currentMode =
                          getEffectiveSettings(selectedRoute).activityMode || DEFAULT_ACTIVITY_MODE
                        if (e.target.value !== currentMode) {
                          updateRouteSettings('activityMode', e.target.value)
                        }
                      }}
                      className="settings-input w-full border border-input bg-background rounded-md"
                    >
                      <option value="hiking">🥾 {t('hiking')}</option>
                      <option value="snowshoes">❄️ {t('snowshoes')}</option>
                      <option value="skiTouring">🎿 {t('skiTouring')}</option>
                    </select>
                  </div>

                  <div
                    className={`grid gap-2 ${
                      (getEffectiveSettings(selectedRoute).timeCalculationMethod ??
                        DEFAULT_TIME_CALCULATION_METHOD) === TIME_CALCULATION_METHODS.ACTIVITY_BLEND
                        ? 'grid-cols-4'
                        : 'grid-cols-3'
                    }`}
                  >
                        <div>
                      <label className="text-[10px] text-muted-foreground">{t('ascentSpeedLabel')}</label>
                    <Input
                      type="number"
                      value={getEffectiveSettings(selectedRoute).ascentSpeed}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value)
                        if (isFinite(n) && n > 0) updateRouteSettings('ascentSpeed', n)
                      }}
                      step="10"
                      className="settings-input"
                    />
                        </div>
                        <div>
                      <label className="text-[10px] text-muted-foreground">{t('descentSpeedLabel')}</label>
                    <Input
                      type="number"
                      value={getEffectiveSettings(selectedRoute).descentSpeed}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value)
                        if (isFinite(n) && n > 0) updateRouteSettings('descentSpeed', n)
                      }}
                      step="10"
                      className="settings-input"
                    />
                        </div>
                        <div>
                      <label className="text-[10px] text-muted-foreground">{t('flatSpeedLabel')}</label>
                    <Input
                      type="number"
                      value={getEffectiveSettings(selectedRoute).flatSpeed}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value)
                        if (isFinite(n) && n > 0) updateRouteSettings('flatSpeed', n)
                      }}
                      step="100"
                      className="settings-input"
                    />
                          </div>
                        {(getEffectiveSettings(selectedRoute).timeCalculationMethod ??
                          DEFAULT_TIME_CALCULATION_METHOD) === TIME_CALCULATION_METHODS.ACTIVITY_BLEND && (
                          <div>
                            <div className="flex items-center gap-0.5 min-h-[14px]">
                              <label className="text-[10px] text-muted-foreground leading-none">
                                {t('downhillFactor')}
                              </label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex text-muted-foreground hover:text-foreground"
                                    aria-label={t('downhillFactorTip')}
                                  >
                                    <CircleHelp className="w-3 h-3" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[200px] text-[11px] leading-snug">
                                  {t('downhillFactorTip')}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Input
                              type="number"
                              min={0.1}
                              max={2}
                              step={0.01}
                              value={getEffectiveSettings(selectedRoute).downhillFactor ?? 2 / 3}
                              onChange={(e) =>
                                updateRouteSettings('downhillFactor', parseFloat(e.target.value) || 2 / 3)
                              }
                              className="settings-input"
                            />
                          </div>
                        )}
                        </div>
                </RouteConfigSection>

                <RouteConfigSection title={t('routeView')} icon={MapIcon}>
                    <p className="text-[10px] text-muted-foreground leading-snug">{t('routeViewDesc')}</p>
                    <div className="space-y-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={routeView.map}
                          onCheckedChange={() => toggleRouteViewVisibility('map')}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-[11px]">{t('showMap')}</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={routeView.elevationGraph}
                          onCheckedChange={() => toggleRouteViewVisibility('elevationGraph')}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-[11px]">{t('showElevationGraph')}</span>
                      </label>
                    </div>
                </RouteConfigSection>

                <RouteConfigSection title={t('columns')} icon={Columns3}>
                    <p className="text-[10px] text-muted-foreground leading-snug">{t('columnsDesc')}</p>
                    <div className="space-y-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={visibleColumns.destinationCoords}
                          onCheckedChange={() => toggleColumnVisibility('destinationCoords')}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-[11px]">{t('destinationCoords')}</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={visibleColumns.routeDistance}
                          onCheckedChange={() => toggleColumnVisibility('routeDistance')}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-[11px]">{t('routeDistance')}</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={visibleColumns.totalTime}
                          onCheckedChange={() => toggleColumnVisibility('totalTime')}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-[11px]">{t('totalTiming')}</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={visibleColumns.progression}
                          onCheckedChange={() => toggleColumnVisibility('progression')}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-[11px]">{t('progression')}</span>
                      </label>
                    </div>
                </RouteConfigSection>

                {selectedRoute && (
                <RouteConfigSection title={t('routeActivityLog')} icon={Clock}>
                    {selectedRoute.log && selectedRoute.log.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                        {selectedRoute.log.map((logEntry, index) => {
                          const date = new Date(logEntry.timestamp);
                          const formattedDate = date.toLocaleDateString();
                          const formattedTime = date.toLocaleTimeString();
                          
                          let icon, bgColor, textColor, borderColor;
                          switch (logEntry.type) {
                            case 'warning':
                              icon = <AlertTriangle className="w-3 h-3" />;
                              bgColor = 'bg-yellow-50 dark:bg-yellow-900/20';
                              textColor = 'text-yellow-800 dark:text-yellow-200';
                              borderColor = 'border-yellow-200 dark:border-yellow-800';
                              break;
                            case 'error':
                            case 'danger':
                              icon = <AlertCircle className="w-3 h-3" />;
                              bgColor = 'bg-red-50 dark:bg-red-900/20';
                              textColor = 'text-red-800 dark:text-red-200';
                              borderColor = 'border-red-200 dark:border-red-800';
                              break;
                            default:
                              icon = <Info className="w-3 h-3" />;
                              bgColor = 'bg-blue-50 dark:bg-blue-900/20';
                              textColor = 'text-blue-800 dark:text-blue-200';
                              borderColor = 'border-blue-200 dark:border-blue-800';
                          }
                          
                          return (
                            <div
                              key={index}
                              className={`p-2 rounded-md border ${bgColor} ${borderColor} ${textColor} text-[10px]`}
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
                      <p className="text-[10px] text-muted-foreground text-center py-3">
                        {t('noActivityLogEntries')}
                      </p>
                    )}
                </RouteConfigSection>
                )}
              </CardContent>
            </Card>
          </div>
        )}

              {showRouteExports && selectedRoute && (
                <div className="lg:w-1/3 lg:order-2">
                  <RouteExportsPanel
                    selectedRoute={selectedRoute}
                    t={t}
                    onClose={() => handlePanelToggle('route-exports')}
                    onExportGPX={handleExportGPX}
                    onExportPDF={handleExportPDF}
                    onExportCSV={handleExportCSV}
                  />
                </div>
              )}

          </>
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

