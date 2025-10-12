/**
 * Calculation Service for GPX parsing and waypoint calculations
 */

import { parseGPX } from '@we-gold/gpxjs';

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate segment time based on distance, elevation change, speed settings, and terrain penalty
 * @param {number} distance - Segment distance in km
 * @param {number} elevationGain - Elevation gain in meters
 * @param {number} elevationLoss - Elevation loss in meters
 * @param {number} terrainPenalty - Terrain difficulty penalty (e.g., 0.1 for 10%)
 * @param {Object} settings - User speed settings
 * @returns {number} Time in minutes
 */
function calculateSegmentTime(distance, elevationGain, elevationLoss, terrainPenalty, settings) {
  const { ascentSpeed, descentSpeed, flatSpeed } = settings;
  
  // Base time calculation
  let baseTime = 0;
  
  if (elevationGain > 0) {
    // For ascent, use ascent speed
    baseTime += (distance / ascentSpeed) * 60;
  } else if (elevationLoss > 0) {
    // For descent, use descent speed
    baseTime += (distance / descentSpeed) * 60;
  } else {
    // For flat, use flat speed
    baseTime += (distance / flatSpeed) * 60;
  }
  
  // Apply terrain difficulty penalty
  const adjustedTime = baseTime * (1 + terrainPenalty);
  
  return adjustedTime;
}

/**
 * Parse GPX file and extract waypoints with calculations
 * @param {string} gpxContent - GPX file content as string
 * @param {Object} settings - User speed settings
 * @returns {Object} Parsed route with waypoints
 */
export function parseGPXFile(gpxContent, settings) {
  try {
    const [parsedGPX, error] = parseGPX(gpxContent);
    
    if (error) {
      throw new Error(`GPX parsing error: ${error}`);
    }
    
    // Extract track points (we'll use the first track)
    const tracks = parsedGPX.tracks || [];
    if (tracks.length === 0) {
      throw new Error('No tracks found in GPX file');
    }
    
    const track = tracks[0];
    // In gpxjs, points are directly on the track object, not in segments
    const allPoints = track.points || [];
    
    if (allPoints.length === 0) {
      throw new Error('No points found in track');
    }
    
    // Convert points to waypoints with calculations
    const waypoints = [];
    let totalDistance = 0;
    let totalAscent = 0;
    let totalDescent = 0;
    let totalTime = 0;
    
    allPoints.forEach((point, index) => {
      let segmentDistance = 0;
      let segmentAscent = 0;
      let segmentDescent = 0;
      let segmentTime = 0;
      
      if (index > 0) {
        const prevPoint = allPoints[index - 1];
        
        // Calculate segment distance
        segmentDistance = calculateDistance(
          prevPoint.latitude,
          prevPoint.longitude,
          point.latitude,
          point.longitude
        );
        
        // Calculate elevation changes
        const elevationChange = point.elevation - prevPoint.elevation;
        if (elevationChange > 0) {
          segmentAscent = elevationChange;
        } else {
          segmentDescent = Math.abs(elevationChange);
        }
        
        // Calculate segment time (with default 0 penalty and 0 stop)
        segmentTime = calculateSegmentTime(
          segmentDistance,
          segmentAscent,
          segmentDescent,
          0, // Default terrain penalty
          settings
        );
        
        totalDistance += segmentDistance;
        totalAscent += segmentAscent;
        totalDescent += segmentDescent;
        totalTime += segmentTime;
      }
      
      waypoints.push({
        id: `waypoint-${index}`,
        name: point.name || `Point ${index + 1}`,
        isDecisionPoint: false,
        latitude: point.latitude,
        longitude: point.longitude,
        elevation: point.elevation || 0,
        segmentDistance: segmentDistance,
        segmentAscent: segmentAscent,
        segmentDescent: segmentDescent,
        totalDistance: totalDistance,
        totalAscent: totalAscent,
        totalDescent: totalDescent,
        terrainDifficultyPenalty: 0,
        stopDuration: 0,
        segmentTime: segmentTime,
        totalTime: totalTime,
        timeTillArrival: 0, // Will be calculated later
        hour: '', // Will be calculated later
        comments: ''
      });
    });
    
    // Calculate time till arrival and hour for each waypoint
    const startTime = settings.startTime || '08:00';
    waypoints.forEach((waypoint, index) => {
      waypoint.timeTillArrival = waypoint.totalTime;
      waypoint.hour = calculateArrivalTime(startTime, waypoint.totalTime);
    });
    
    return {
      gpxData: parsedGPX,
      waypoints: waypoints,
      metadata: {
        name: track.name || 'Unnamed Route',
        totalDistance: totalDistance,
        totalAscent: totalAscent,
        totalDescent: totalDescent
      }
    };
  } catch (error) {
    console.error('Error parsing GPX file:', error);
    throw error;
  }
}

/**
 * Calculate arrival time based on start time and elapsed minutes
 * @param {string} startTime - Start time in HH:MM format
 * @param {number} elapsedMinutes - Elapsed time in minutes
 * @returns {string} Arrival time in HH:MM format
 */
function calculateArrivalTime(startTime, elapsedMinutes) {
  const [hours, minutes] = startTime.split(':').map(Number);
  const startDate = new Date();
  startDate.setHours(hours, minutes, 0, 0);
  
  const arrivalDate = new Date(startDate.getTime() + elapsedMinutes * 60000);
  
  const arrivalHours = String(arrivalDate.getHours()).padStart(2, '0');
  const arrivalMinutes = String(arrivalDate.getMinutes()).padStart(2, '0');
  
  return `${arrivalHours}:${arrivalMinutes}`;
}

/**
 * Recalculate waypoint times based on updated settings or waypoint data
 * @param {Array} waypoints - Array of waypoints
 * @param {Object} settings - User speed settings
 * @returns {Array} Updated waypoints
 */
export function recalculateWaypoints(waypoints, settings) {
  let totalTime = 0;
  
  const updatedWaypoints = waypoints.map((waypoint, index) => {
    let segmentTime = 0;
    
    if (index > 0) {
      // Recalculate segment time with current terrain penalty
      segmentTime = calculateSegmentTime(
        waypoint.segmentDistance,
        waypoint.segmentAscent,
        waypoint.segmentDescent,
        waypoint.terrainDifficultyPenalty,
        settings
      );
      
      // Add stop duration
      totalTime += segmentTime + waypoint.stopDuration;
    }
    
    return {
      ...waypoint,
      segmentTime: segmentTime,
      totalTime: totalTime,
      timeTillArrival: totalTime,
      hour: calculateArrivalTime(settings.startTime || '08:00', totalTime)
    };
  });
  
  return updatedWaypoints;
}

