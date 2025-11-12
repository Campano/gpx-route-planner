import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseGPXFile } from './calculationService.js'
import { checkWaypointModifications } from './gpxExportService.js'
import { convertToUTM } from './gpxParser.js'

const defaultSettings = {
  activityMode: 'hiking',
  activityModes: {
    hiking: {
      ascentSpeed: 300,
      descentSpeed: 500,
      flatSpeed: 4000
    }
  },
  startTime: '08:00',
  distanceCalculationMethod: 'track',
  safetyTimePercentage: 20
}

describe('parseGPXFile', () => {
  it('keeps the final segment metrics when no explicit GPX waypoints exist', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const gpxPath = resolve(__dirname, '../../test-data/test-end-waypoint.gpx')
    const gpxContent = readFileSync(gpxPath, 'utf-8')

    const route = parseGPXFile(gpxContent, defaultSettings)

    const lastWaypoint = route.waypoints[route.waypoints.length - 1]
    const previousWaypoint = route.waypoints[route.waypoints.length - 2]

    expect(route.waypoints.length).toBeGreaterThan(1)
    expect(lastWaypoint.isEndPoint).toBe(true)
    expect(lastWaypoint.segmentDistance).toBeGreaterThan(0.01)
    expect(lastWaypoint.segmentTime).toBeGreaterThan(0)
    expect(lastWaypoint.totalDistance).toBeGreaterThan(previousWaypoint.totalDistance)

    const totalElevationChange = lastWaypoint.segmentAscent + lastWaypoint.segmentDescent
    expect(totalElevationChange).toBeGreaterThan(0)
  })

  it('keeps the first segment metrics when using waypoint-to-waypoint mode', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const gpxPath = resolve(__dirname, '../../test-data/test-end-waypoint.gpx')
    const gpxContent = readFileSync(gpxPath, 'utf-8')

    const route = parseGPXFile(gpxContent, {
      ...defaultSettings,
      distanceCalculationMethod: 'waypoint-to-waypoint'
    })

    expect(route.waypoints.length).toBeGreaterThan(1)

    const firstNonStart = route.waypoints[1]

    expect(firstNonStart.segmentDistance).toBeGreaterThan(0.01)
    const totalElevationChange = firstNonStart.segmentAscent + firstNonStart.segmentDescent
    expect(totalElevationChange).toBeGreaterThan(0)
    expect(firstNonStart.segmentTime).toBeGreaterThan(0)
  })

  it('produces the expected waypoint count for test-calc-method.gpx', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const gpxPath = resolve(__dirname, '../../test-data/test-calc-method.gpx')
    const gpxContent = readFileSync(gpxPath, 'utf-8')

    const route = parseGPXFile(gpxContent, defaultSettings)

    expect(route.waypoints.length).toBe(4)
    const lastWaypoint = route.waypoints[route.waypoints.length - 1]
    expect(lastWaypoint.isEndPoint).toBe(true)
    const endWaypoints = route.waypoints.filter((wp) => wp.isEndPoint)
    expect(endWaypoints).toHaveLength(1)
  })

  it('uses GPX waypoint names when the start/end align with named points', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const gpxPath = resolve(__dirname, '../../test-data/mont-blanc-ascent.gpx')
    const gpxContent = readFileSync(gpxPath, 'utf-8')

    const route = parseGPXFile(gpxContent, defaultSettings)

    expect(route.waypoints[0].name).toBe('Chamonix Start')
    const endWaypoint = route.waypoints.find((wp) => wp.isEndPoint)
    expect(endWaypoint).toBeTruthy()
    expect(endWaypoint?.name).toBe('Mont Blanc Summit')
    if (endWaypoint) {
      expect(route.waypoints[route.waypoints.length - 1]).toBe(endWaypoint)
    }
  })

  it('reports zero modifications after importing mont-blanc-ascent.gpx', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const gpxPath = resolve(__dirname, '../../test-data/mont-blanc-ascent.gpx')
    const gpxContent = readFileSync(gpxPath, 'utf-8')

    const route = parseGPXFile(gpxContent, defaultSettings)

    // Check that gpxData is properly stored
    expect(route.gpxData).toBeTruthy()
    expect(route.gpxData.waypoints).toBeTruthy()
    expect(Array.isArray(route.gpxData.waypoints)).toBe(true)

    // Check modifications - should be zero after import
    const modifications = checkWaypointModifications(route)

    expect(modifications.modified).toBe(false)
    expect(modifications.added).toBe(0)
    expect(modifications.removed).toBe(0)
    expect(modifications.renamed).toBe(0)
    expect(modifications.totalOriginal).toBeGreaterThan(0)
    expect(modifications.totalCurrent).toBe(modifications.totalOriginal)
  })
})

describe('convertToUTM', () => {
  it('converts latitude and longitude to UTM coordinates correctly', () => {
    // Test case: Mont Blanc area coordinates
    // Lat: 45.922265, Lon: 7.044640
    // Expected: Zone 32T, 348381E, 5087270N
    const lat = 45.922265
    const lon = 7.044640
    
    const result = convertToUTM(lat, lon)
    
    // Check zone (32T)
    expect(result).toMatch(/Zone 32T/)
    
    // Extract and verify coordinates
    const eastingMatch = result.match(/(\d+)E/)
    const northingMatch = result.match(/(\d+)N/)
    
    expect(eastingMatch).toBeTruthy()
    expect(northingMatch).toBeTruthy()
    
    const easting = parseInt(eastingMatch[1], 10)
    const northing = parseInt(northingMatch[1], 10)
    
    // Expected values: 348381E 5087270N
    // Using the utm library for accurate coordinate conversion
    expect(easting).toBe(348381)
    expect(northing).toBe(5087270)
  })
  
  it('calculates correct UTM zone number from longitude', () => {
    // Zone 32 covers 6°E to 12°E
    // 7.044640°E should be in zone 32
    const lat = 45.922265
    const lon = 7.044640
    
    const result = convertToUTM(lat, lon)
    expect(result).toMatch(/Zone 32/)
  })
  
  it('calculates correct UTM zone letter from latitude', () => {
    // Zone T covers 40°N to 48°N
    // 45.922265°N should be in zone T
    const lat = 45.922265
    const lon = 7.044640
    
    const result = convertToUTM(lat, lon)
    expect(result).toMatch(/Zone \d+T/)
  })
})

