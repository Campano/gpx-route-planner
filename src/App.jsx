import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx'
import { Upload, Mountain, Settings, Settings2, FileText, Trash2, Download, ChevronLeft, ChevronRight, Eye, EyeOff, FolderOpen, Edit3, AlertTriangle, HelpCircle, Info, X, Globe, Plus } from 'lucide-react'
import { parseGPXFile, recalculateWaypoints, formatTimeHoursMinutes, formatTimeHoursMinutesForMin, formatTotalTimeWithPercentage } from './lib/calculationService.js'
import { exportRouteToPDF } from './lib/pdfExportService.js'
import GitHubCorner from './components/GitHubCorner.jsx'
import packageJson from '../package.json'
import { translations, languages } from './lib/translations.js'
import './App.css'

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
      ascentSpeed: 300, // m/h (meters per hour)
      descentSpeed: 400, // m/h
      flatSpeed: 5000, // m/h (5 km/h = 5000 m/h)
      startTime: '08:00',
      distanceCalculationMethod: 'track', // 'track' or 'waypoint-to-waypoint'
      safetyTimePercentage: 10 // Safety time as percentage (10% = 10)
    }
  })
  const [activePanel, setActivePanel] = useState('route-manager') // 'route-manager', 'general-settings', 'route-settings', 'help', null
  const [editingWaypoint, setEditingWaypoint] = useState(null)
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('mountain-route-planner-language')
    return saved || 'en'
  })
  const [isDragOver, setIsDragOver] = useState(false)
  const [showNewRoute, setShowNewRoute] = useState(false)
  const dragCounterRef = useRef(0)

  // Translation helper
  const t = (key) => {
    return translations[language]?.[key] || translations.en[key] || key
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
        setRoutes(parsedRoutes)
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
    return route?.settings || settings
  }

  // Handle GPX file upload
  const handleFileUpload = async (file) => {
    if (!file) return

    try {
      const content = await file.text()
      const parsed = parseGPXFile(content, settings)
      
      const newRoute = {
        id: `route-${Date.now()}`,
        name: parsed.metadata.name || file.name.replace('.gpx', ''),
        gpxData: parsed.gpxData,
        waypoints: parsed.waypoints,
        settings: null, // null means use default settings
        createdAt: Date.now()
      }
      
      setRoutes([...routes, newRoute])
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
  const updateWaypoint = (waypointId, field, value) => {
    if (!selectedRoute) return

    const updatedWaypoints = selectedRoute.waypoints.map(wp => {
      if (wp.id === waypointId) {
        return { ...wp, [field]: value }
      }
      return wp
    })

    // Recalculate times if penalty or stop duration changed
    if (field === 'terrainDifficultyPenalty' || field === 'stopDuration') {
      const effectiveSettings = getEffectiveSettings(selectedRoute)
      const recalculated = recalculateWaypoints(updatedWaypoints, effectiveSettings)
      const updatedRoute = { ...selectedRoute, waypoints: recalculated }
      setSelectedRoute(updatedRoute)
      setRoutes(routes.map(r => r.id === updatedRoute.id ? updatedRoute : r))
    } else {
      const updatedRoute = { ...selectedRoute, waypoints: updatedWaypoints }
      setSelectedRoute(updatedRoute)
      setRoutes(routes.map(r => r.id === updatedRoute.id ? updatedRoute : r))
    }
  }

  // Delete route
  const deleteRoute = (routeId) => {
    setRoutes(routes.filter(r => r.id !== routeId))
    if (selectedRoute?.id === routeId) {
      setSelectedRoute(null)
    }
  }

  // Update default settings
  const updateDefaultSettings = (field, value) => {
    const newSettings = { ...settings, [field]: value }
    setSettings(newSettings)
    
    // Recalculate all routes that use default settings
    const updatedRoutes = routes.map(route => {
      if (!route.settings) { // Route uses default settings
        const recalculated = recalculateWaypoints(route.waypoints, newSettings)
        return { ...route, waypoints: recalculated }
      }
      return route
    })
    setRoutes(updatedRoutes)
    
    // Update selected route if it uses default settings
    if (selectedRoute && !selectedRoute.settings) {
      const recalculated = recalculateWaypoints(selectedRoute.waypoints, newSettings)
      setSelectedRoute({ ...selectedRoute, waypoints: recalculated })
    }
  }

  // Update route-specific settings
  const updateRouteSettings = (field, value) => {
    if (!selectedRoute) return
    
    const newRouteSettings = { 
      ...getEffectiveSettings(selectedRoute), 
      [field]: value 
    }
    
    const updatedRoute = { ...selectedRoute, settings: newRouteSettings }
    const recalculated = recalculateWaypoints(updatedRoute.waypoints, newRouteSettings)
    updatedRoute.waypoints = recalculated
    
      setSelectedRoute(updatedRoute)
      setRoutes(routes.map(r => r.id === updatedRoute.id ? updatedRoute : r))
    }

  // Reset route to use default settings
  const resetRouteToDefault = () => {
    if (!selectedRoute) return
    
    const updatedRoute = { ...selectedRoute, settings: null }
    const recalculated = recalculateWaypoints(updatedRoute.waypoints, settings)
    updatedRoute.waypoints = recalculated
    
    setSelectedRoute(updatedRoute)
    setRoutes(routes.map(r => r.id === updatedRoute.id ? updatedRoute : r))
  }

  // Export to PDF
  const handleExportPDF = () => {
    if (!selectedRoute) {
      alert('Please select a route to export')
      return
    }
    exportRouteToPDF(selectedRoute, settings)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6 relative">
      <GitHubCorner url="https://github.com/Campano/gpx-route-planner/issues" />
      
      {/* Warning Banner */}
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 -m-6 mb-6">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-yellow-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">Beta Version:</span>
          <span>{t('betaWarning')} </span>
          <a 
            href="https://github.com/Campano/gpx-route-planner/issues" 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline hover:text-yellow-900 font-medium"
          >
            {t('issuesPage')}
          </a>
          <span>.</span>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mountain className="w-10 h-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t('appTitle')}</h1>
              <p className="text-sm text-muted-foreground">{t('appDescription')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePanelToggle('route-manager')}
              title={showRouteManager ? "Hide route manager" : "Show route manager"}
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
              onClick={() => handlePanelToggle('general-settings')}
              title={showSettings ? "Hide general settings" : "Show general settings"}
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
            onClick={() => handlePanelToggle('help')}
            title={showHelp ? "Hide help" : "Show help"}
          >
            {showHelp ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <HelpCircle className="w-4 h-4" />
            )}
          </Button>
          </div>
        </div>


            {/* Route Details and Panels */}
            <div className="flex flex-col lg:flex-row gap-6">
          {/* Waypoint Table - Main content */}
          <div className={`flex-1 ${activePanel ? 'lg:w-2/3' : 'w-full'}`}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedRoute ? t('routeDetails') : t('newRoute')}</CardTitle>
                  <CardDescription>
                    {selectedRoute ? (
                      <>
                        {selectedRoute.waypoints.length} {t('waypoints')}
                        {selectedRoute.waypoints.length > 0 && selectedRoute.waypoints[0].utm && (
                          <span className="ml-2 text-muted-foreground">
                            • UTM Zone: {selectedRoute.waypoints[0].utm.split(' ')[1]}
                          </span>
                        )}
                      </>
                    ) : (
                      t('uploadGPX')
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedRoute && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePanelToggle('route-settings')}
                        title={showRouteSettings ? "Hide route settings" : "Configure route-specific settings"}
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
                      <Button onClick={handleExportPDF} variant="default">
                        <Download className="w-4 h-4 mr-2" />
                        {t('exportPDF')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedRoute ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                          {/* Group Header Row */}
                          <TableRow>
                            <TableHead rowSpan={2} className="w-40 text-center bg-muted/50">{t('location')}</TableHead>
                            <TableHead rowSpan={2} className="w-24 text-center bg-muted/50">{t('segment')}</TableHead>
                            <TableHead rowSpan={2} className="w-24 text-center bg-muted/50">{t('route')}</TableHead>
                            <TableHead colSpan={6} className="text-center bg-muted/50">{t('timing')}</TableHead>
                            <TableHead rowSpan={2} className="w-48 min-w-48 max-w-48 text-center bg-muted/50">{t('notes')}</TableHead>
                          </TableRow>
                          {/* Column Header Row */}
                          <TableRow>
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
                              {/* Location Column */}
                              <TableCell className="w-40">
                                <div className="space-y-1">
                                  <div className={`h-8 px-2 py-1 text-xs font-medium rounded border flex items-center ${
                                    waypoint.isStartPoint ? 'bg-green-100 text-green-800 border-green-300' :
                                    waypoint.isEndPoint ? 'bg-red-100 text-red-800 border-red-300' :
                                    'bg-muted/30'
                                  }`}>
                                    {waypoint.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground text-center">
                                    {waypoint.utm ? waypoint.utm.replace(/^Zone \d+ /, '') : 'N/A'}
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
                                    <span className="text-sm font-medium ml-1">
                                      {waypoint.elevation.toFixed(0)}m
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                          {/* Segment Columns */}
                          <TableCell className="text-xs text-center">
                            <div className="space-y-1">
                              <div className="text-green-600 font-medium">↑{waypoint.segmentAscent.toFixed(0)}m</div>
                              <div className="text-red-600 font-medium">↓{waypoint.segmentDescent.toFixed(0)}m</div>
                              <div className="text-blue-600 font-medium">{waypoint.segmentDistance.toFixed(2)}km</div>
                            </div>
                          </TableCell>
                          {/* Route Columns */}
                          <TableCell className="text-xs text-center">
                            <div className="space-y-1">
                              <div className="text-green-600 font-medium">↑{waypoint.totalAscent.toFixed(0)}m</div>
                              <div className="text-red-600 font-medium">↓{waypoint.totalDescent.toFixed(0)}m</div>
                              <div className="text-blue-600 font-medium">{waypoint.totalDistance.toFixed(2)}km</div>
                            </div>
                          </TableCell>
                          {/* Timing Columns (segment time first, then adaptations) */}
                          <TableCell className="text-xs text-center">{formatTimeHoursMinutesForMin(waypoint.segmentTime)}</TableCell>
                          <TableCell>
                <Input
                  type="number"
                              value={waypoint.terrainDifficultyPenalty}
                              onChange={(e) => updateWaypoint(waypoint.id, 'terrainDifficultyPenalty', parseFloat(e.target.value) || 0)}
                  step="0.1"
                              className="h-8 text-xs w-20 text-center"
                />
                          </TableCell>
                          <TableCell>
                <Input
                  type="number"
                              value={waypoint.stopDuration}
                              onChange={(e) => updateWaypoint(waypoint.id, 'stopDuration', parseFloat(e.target.value) || 0)}
                              className="h-8 text-xs w-20 text-center"
                            />
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            {formatTimeHoursMinutesForMin(waypoint.totalTime)}
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            {(() => {
                              const lastWaypoint = selectedRoute.waypoints[selectedRoute.waypoints.length - 1];
                              const percentage = lastWaypoint.totalTime > 0 ? Math.round((waypoint.totalTime / lastWaypoint.totalTime) * 100) : 0;
                              return `${percentage}%`;
                            })()}
                          </TableCell>
                          <TableCell className="text-xs text-center">{waypoint.hour}</TableCell>
                          {/* Notes Column */}
                          <TableCell className="w-48 min-w-48 max-w-48">
                            {editingWaypoint === waypoint.id ? (
                              <Textarea
                                value={waypoint.comments}
                                onChange={(e) => updateWaypoint(waypoint.id, 'comments', e.target.value)}
                                className="min-h-8 text-xs resize-none w-full"
                                placeholder="Notes..."
                                rows={3}
                                onBlur={() => setEditingWaypoint(null)}
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-start gap-2 w-full">
                                <div className="flex-1 text-xs break-words whitespace-pre-wrap break-all">
                                  {waypoint.comments || (
                                    <span className="text-muted-foreground italic">No notes</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => setEditingWaypoint(waypoint.id)}
                                  className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                  title="Edit notes"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                          ))}
                          
                          {/* Safety Time Row */}
                          {selectedRoute.waypoints.length > 0 && (
                            <TableRow className="bg-muted/20 font-medium">
                              {/* Location Column */}
                              <TableCell className="w-40">
                                <div className="text-xs font-medium text-center">
                                  {t('safetyTime')}
                                </div>
                              </TableCell>
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
                                100%
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
              ) : (
                <div className="py-12">
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer transition-all duration-200 hover:border-primary hover:bg-accent/50"
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <Upload className={`w-16 h-16 mx-auto mb-4 transition-colors ${
                      isDragOver ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                    <h3 className={`text-lg font-semibold mb-2 transition-colors ${
                      isDragOver ? 'text-primary' : ''
                    }`}>
                      {isDragOver ? t('dropGPXFileHere') : t('uploadGPXFile')}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('dragDropZone')}
                    </p>
                    <label htmlFor="gpx-upload-main">
                      <Button variant="outline" asChild>
                        <div className="cursor-pointer">
                          <Upload className="w-4 h-4 mr-2" />
                          {t('selectFile')}
              </div>
                      </Button>
                <Input
                        id="gpx-upload-main"
                        type="file"
                        accept=".gpx"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                    </label>
                  </div>
              </div>
              )}
            </CardContent>
          </Card>
          </div>

              {/* Route Manager Panel */}
              {showRouteManager && (
                <div className="lg:w-1/3">
                  <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('routeManager')}</CardTitle>
                  <CardDescription>{t('manageRoutes')}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePanelToggle('route-manager')}
                  title="Close panel"
                  className="h-6 w-6 p-0 -mt-1 -mr-1"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
                {/* New Route Button - Only show when a route is selected */}
                {selectedRoute && (
                  <div className="mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRoute(null)}
                      title="Create new route"
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t('addRoute')}
                    </Button>
                  </div>
                )}

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
                          : 'bg-card border-border hover:bg-accent'
                      }`}
                      onClick={() => setSelectedRoute(route)}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm font-medium truncate">{route.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteRoute(route.id)
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
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
            </CardContent>
          </Card>
                </div>
              )}

              {/* General Settings Panel */}
              {showSettings && (
                <div className="lg:w-1/3">
                  <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('generalSettings')}</CardTitle>
                  <CardDescription>
                    {t('configureDefaults')}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePanelToggle('general-settings')}
                  title="Close panel"
                  className="h-6 w-6 p-0 -mt-1 -mr-1"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
                {/* Language Selector */}
                <div className="mb-6">
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
                
                <div>
                  <h4 className="text-sm font-medium mb-4">{t('defaultSettings')}</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-medium">{t('ascentSpeed')}</label>
                            <Input
                        type="number"
                        value={settings.ascentSpeed}
                        onChange={(e) => updateDefaultSettings('ascentSpeed', parseFloat(e.target.value))}
                        step="10"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('descentSpeed')}</label>
                            <Input
                              type="number"
                              value={settings.descentSpeed}
                              onChange={(e) => updateDefaultSettings('descentSpeed', parseFloat(e.target.value))}
                              step="10"
                              className="mt-1"
                            />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('flatSpeed')}</label>
                            <Input
                              type="number"
                              value={settings.flatSpeed}
                              onChange={(e) => updateDefaultSettings('flatSpeed', parseFloat(e.target.value))}
                              step="100"
                              className="mt-1"
                            />
                    </div>
                        <div>
                          <label className="text-sm font-medium">{t('startTime')}</label>
                            <Input
                            type="time"
                            value={settings.startTime}
                            onChange={(e) => updateDefaultSettings('startTime', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
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
                        <div>
                          <label className="text-sm font-medium">{t('safetyTime')}</label>
                          <Input
                            type="number"
                            value={settings.safetyTimePercentage}
                            onChange={(e) => updateDefaultSettings('safetyTimePercentage', parseFloat(e.target.value) || 0)}
                            step="1"
                            min="0"
                            max="100"
                            className="mt-1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Additional time buffer as percentage of total route time
                          </p>
                        </div>
                  </div>
                </div>
              </CardContent>
                  </Card>
                </div>
              )}

              {/* Route Settings Panel */}
              {showRouteSettings && selectedRoute && (
                <div className="lg:w-1/3">
                  <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('routeSettings')}</CardTitle>
                    <CardDescription>
                      Configure settings for "{selectedRoute.name}" (overrides default)
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePanelToggle('route-settings')}
                    title="Close panel"
                    className="h-6 w-6 p-0 -mt-1 -mr-1"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Route-specific settings */}
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium">Route-Specific Settings</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetRouteToDefault}
                    >
                      Use Defaults
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-medium">Ascent Speed (m/h)</label>
                      <Input
                        type="number"
                        value={getEffectiveSettings(selectedRoute).ascentSpeed}
                        onChange={(e) => updateRouteSettings('ascentSpeed', parseFloat(e.target.value))}
                        step="10"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Descent Speed (m/h)</label>
                      <Input
                        type="number"
                        value={getEffectiveSettings(selectedRoute).descentSpeed}
                        onChange={(e) => updateRouteSettings('descentSpeed', parseFloat(e.target.value))}
                        step="10"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Flat Speed (m/h)</label>
                      <Input
                        type="number"
                        value={getEffectiveSettings(selectedRoute).flatSpeed}
                        onChange={(e) => updateRouteSettings('flatSpeed', parseFloat(e.target.value))}
                        step="100"
                        className="mt-1"
                      />
                    </div>
                        <div>
                          <label className="text-sm font-medium">{t('startTime')}</label>
                          <Input
                            type="time"
                            value={getEffectiveSettings(selectedRoute).startTime}
                            onChange={(e) => updateRouteSettings('startTime', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Distance Calculation</label>
                          <select
                            value={getEffectiveSettings(selectedRoute).distanceCalculationMethod}
                            onChange={(e) => updateRouteSettings('distanceCalculationMethod', e.target.value)}
                            className="mt-1 w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                          >
                            <option value="track">Track-based (recommended)</option>
                            <option value="waypoint-to-waypoint">Waypoint to waypoint</option>
                          </select>
                          <p className="text-xs text-muted-foreground mt-1">
                            {getEffectiveSettings(selectedRoute).distanceCalculationMethod === 'track' 
                              ? 'Uses actual track path for accurate distances'
                              : 'Uses straight-line distance between waypoints'
                            }
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Safety Time (%)</label>
                          <Input
                            type="number"
                            value={getEffectiveSettings(selectedRoute).safetyTimePercentage}
                            onChange={(e) => updateRouteSettings('safetyTimePercentage', parseFloat(e.target.value) || 0)}
                            step="1"
                            min="0"
                            max="100"
                            className="mt-1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Additional time buffer as percentage of total route time
                          </p>
                        </div>
                  </div>
                </div>
                
                {/* Default settings reference */}
                <div>
                  <h4 className="text-sm font-medium mb-4">Default Settings (Reference)</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Ascent Speed (m/h)</label>
                      <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md text-sm text-muted-foreground">
                        {settings.ascentSpeed}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Descent Speed (m/h)</label>
                      <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md text-sm text-muted-foreground">
                        {settings.descentSpeed}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Flat Speed (m/h)</label>
                      <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md text-sm text-muted-foreground">
                        {settings.flatSpeed}
                      </div>
                    </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">{t('startTime')}</label>
                          <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md text-sm text-muted-foreground">
                            {settings.startTime}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Distance Calculation</label>
                          <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md text-sm text-muted-foreground">
                            {settings.distanceCalculationMethod === 'track' ? 'Track-based' : 'Waypoint to waypoint'}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Safety Time (%)</label>
                          <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md text-sm text-muted-foreground">
                            {settings.safetyTimePercentage}%
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
                <div className="lg:w-1/3">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{t('help')}</CardTitle>
                          <CardDescription>
                            {t('technicalDetailsDesc')}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePanelToggle('help')}
                          title="Close panel"
                          className="h-6 w-6 p-0 -mt-1 -mr-1"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* Technical Details */}
                        <div>
                          <h4 className="text-sm font-medium mb-3">{t('technicalDetails')}</h4>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <div>• <strong className="text-foreground">{t('distanceCalculation')}:</strong> {t('distanceCalculationDesc')}</div>
                            <div>• <strong className="text-foreground">{t('timeCalculation')}:</strong> {t('timeCalculationDesc')}</div>
                            <div>• <strong className="text-foreground">{t('utmCoordinates')}:</strong> {t('utmCoordinatesDesc')}</div>
                            <div>• <strong className="text-foreground">{t('safetyBuffer')}:</strong> {t('safetyBufferDesc')}</div>
                            <div>• <strong className="text-foreground">{t('gpxParsing')}:</strong> {t('gpxParsingDesc')}</div>
                            <div>• <strong className="text-foreground">{t('pdfExport')}:</strong> {t('pdfExportDesc')}</div>
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
    </div>
  )
}

export default App

