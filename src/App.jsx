import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx'
import { Upload, Mountain, Settings, FileText, Trash2, Download } from 'lucide-react'
import { parseGPXFile, recalculateWaypoints } from './lib/calculationService.js'
import { exportRouteToPDF } from './lib/pdfExportService.js'
import './App.css'

function App() {
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [settings, setSettings] = useState({
    ascentSpeed: 3,
    descentSpeed: 4,
    flatSpeed: 5,
    startTime: '08:00'
  })
  const [showSettings, setShowSettings] = useState(false)

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

  // Handle GPX file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    try {
      const content = await file.text()
      const parsed = parseGPXFile(content, settings)
      
      const newRoute = {
        id: `route-${Date.now()}`,
        name: parsed.metadata.name || file.name.replace('.gpx', ''),
        gpxData: parsed.gpxData,
        waypoints: parsed.waypoints,
        createdAt: Date.now()
      }
      
      setRoutes([...routes, newRoute])
      setSelectedRoute(newRoute)
    } catch (error) {
      alert(`Error parsing GPX file: ${error.message}`)
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
      const recalculated = recalculateWaypoints(updatedWaypoints, settings)
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

  // Update settings
  const updateSettings = (field, value) => {
    const newSettings = { ...settings, [field]: value }
    setSettings(newSettings)
    
    // Recalculate all routes with new settings
    if (selectedRoute) {
      const recalculated = recalculateWaypoints(selectedRoute.waypoints, newSettings)
      const updatedRoute = { ...selectedRoute, waypoints: recalculated }
      setSelectedRoute(updatedRoute)
      setRoutes(routes.map(r => r.id === updatedRoute.id ? updatedRoute : r))
    }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mountain className="w-10 h-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Mountain Route Planner</h1>
              <p className="text-sm text-muted-foreground">Plan your mountaineering routes with precision</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <Card>
            <CardHeader>
              <CardTitle>Speed Settings</CardTitle>
              <CardDescription>Configure your average speeds for different terrain types</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Ascent Speed (km/h)</label>
                <Input
                  type="number"
                  value={settings.ascentSpeed}
                  onChange={(e) => updateSettings('ascentSpeed', parseFloat(e.target.value))}
                  step="0.1"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descent Speed (km/h)</label>
                <Input
                  type="number"
                  value={settings.descentSpeed}
                  onChange={(e) => updateSettings('descentSpeed', parseFloat(e.target.value))}
                  step="0.1"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Flat Speed (km/h)</label>
                <Input
                  type="number"
                  value={settings.flatSpeed}
                  onChange={(e) => updateSettings('flatSpeed', parseFloat(e.target.value))}
                  step="0.1"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Start Time</label>
                <Input
                  type="time"
                  value={settings.startTime}
                  onChange={(e) => updateSettings('startTime', e.target.value)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload and Route List */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Upload Section */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Upload GPX</CardTitle>
              <CardDescription>Import your route file</CardDescription>
            </CardHeader>
            <CardContent>
              <label htmlFor="gpx-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
                  <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload GPX file</p>
                  <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
                </div>
                <Input
                  id="gpx-upload"
                  type="file"
                  accept=".gpx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Route List */}
              {routes.length > 0 && (
                <div className="mt-6 space-y-2">
                  <h3 className="text-sm font-semibold">Saved Routes</h3>
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
            </CardContent>
          </Card>

          {/* Waypoint Table */}
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Route Details</CardTitle>
                  <CardDescription>
                    {selectedRoute ? `${selectedRoute.waypoints.length} waypoints` : 'Select or upload a route to view details'}
                  </CardDescription>
                </div>
                {selectedRoute && (
                  <Button onClick={handleExportPDF} variant="default">
                    <Download className="w-4 h-4 mr-2" />
                    Export PDF
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedRoute ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Name</TableHead>
                        <TableHead className="w-20">Decision</TableHead>
                        <TableHead className="w-24">Elevation (m)</TableHead>
                        <TableHead className="w-24">Seg Dist (km)</TableHead>
                        <TableHead className="w-24">Seg Asc (m)</TableHead>
                        <TableHead className="w-24">Seg Desc (m)</TableHead>
                        <TableHead className="w-24">Total Dist (km)</TableHead>
                        <TableHead className="w-24">Total Asc (m)</TableHead>
                        <TableHead className="w-24">Total Desc (m)</TableHead>
                        <TableHead className="w-24">Penalty (%)</TableHead>
                        <TableHead className="w-24">Stop (min)</TableHead>
                        <TableHead className="w-24">Seg Time (min)</TableHead>
                        <TableHead className="w-24">Total Time (min)</TableHead>
                        <TableHead className="w-24">Hour</TableHead>
                        <TableHead className="w-48">Comments</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRoute.waypoints.map((waypoint) => (
                        <TableRow key={waypoint.id}>
                          <TableCell>
                            <Input
                              value={waypoint.name}
                              onChange={(e) => updateWaypoint(waypoint.id, 'name', e.target.value)}
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={waypoint.isDecisionPoint}
                              onChange={(e) => updateWaypoint(waypoint.id, 'isDecisionPoint', e.target.checked)}
                              className="w-4 h-4"
                            />
                          </TableCell>
                          <TableCell className="text-xs">{waypoint.elevation.toFixed(0)}</TableCell>
                          <TableCell className="text-xs">{waypoint.segmentDistance.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">{waypoint.segmentAscent.toFixed(0)}</TableCell>
                          <TableCell className="text-xs">{waypoint.segmentDescent.toFixed(0)}</TableCell>
                          <TableCell className="text-xs">{waypoint.totalDistance.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">{waypoint.totalAscent.toFixed(0)}</TableCell>
                          <TableCell className="text-xs">{waypoint.totalDescent.toFixed(0)}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={waypoint.terrainDifficultyPenalty}
                              onChange={(e) => updateWaypoint(waypoint.id, 'terrainDifficultyPenalty', parseFloat(e.target.value) || 0)}
                              step="0.1"
                              className="h-8 text-xs w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={waypoint.stopDuration}
                              onChange={(e) => updateWaypoint(waypoint.id, 'stopDuration', parseFloat(e.target.value) || 0)}
                              className="h-8 text-xs w-20"
                            />
                          </TableCell>
                          <TableCell className="text-xs">{waypoint.segmentTime.toFixed(0)}</TableCell>
                          <TableCell className="text-xs">{waypoint.totalTime.toFixed(0)}</TableCell>
                          <TableCell className="text-xs">{waypoint.hour}</TableCell>
                          <TableCell>
                            <Input
                              value={waypoint.comments}
                              onChange={(e) => updateWaypoint(waypoint.id, 'comments', e.target.value)}
                              className="h-8 text-xs"
                              placeholder="Add notes..."
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Mountain className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No route selected. Upload a GPX file to get started.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default App

