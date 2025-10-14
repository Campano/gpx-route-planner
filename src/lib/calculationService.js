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
 * Convert latitude/longitude to UTM coordinates (simplified)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string} UTM coordinates as string
 */
function convertToUTM(lat, lon) {
  // Simplified UTM conversion - in a real implementation, you'd use a proper UTM library
  // For now, we'll create a simple representation
  const zone = Math.floor((lon + 180) / 6) + 1;
  const easting = Math.round((lon + 180) * 1000000) % 1000000;
  const northing = Math.round((lat + 90) * 1000000) % 1000000;
  return `Zone ${zone} ${easting.toFixed(0)}E ${northing.toFixed(0)}N`;
}

/**
 * Calculate maximum elevation from track points
 * @param {Array} trackPoints - Array of track points
 * @returns {number} Maximum elevation in meters
 */
function calculateMaxElevation(trackPoints) {
  let maxElevation = -Infinity;
  trackPoints.forEach(point => {
    if (point.elevation && point.elevation > maxElevation) {
      maxElevation = point.elevation;
    }
  });
  return maxElevation === -Infinity ? 0 : maxElevation;
}

/**
 * Calculate segment time using proper t = sum(d/v) formula (pure movement time only)
 * @param {number} distance - Segment distance in km
 * @param {number} elevationGain - Elevation gain in meters
 * @param {number} elevationLoss - Elevation loss in meters
 * @param {Object} settings - User speed settings with speeds in m/h
 * @returns {number} Time in minutes
 */
function calculateSegmentTime(distance, elevationGain, elevationLoss, settings) {
  // Validate inputs and provide defaults
  const ascentSpeed = settings?.ascentSpeed || 300; // m/h default
  const descentSpeed = settings?.descentSpeed || 400; // m/h default  
  const flatSpeed = settings?.flatSpeed || 5000; // m/h default
  
  // Validate that speeds are valid numbers
  if (!isFinite(ascentSpeed) || ascentSpeed <= 0) {
    console.warn('Invalid ascentSpeed:', ascentSpeed, 'using default 300');
    ascentSpeed = 300;
  }
  if (!isFinite(descentSpeed) || descentSpeed <= 0) {
    console.warn('Invalid descentSpeed:', descentSpeed, 'using default 400');
    descentSpeed = 400;
  }
  if (!isFinite(flatSpeed) || flatSpeed <= 0) {
    console.warn('Invalid flatSpeed:', flatSpeed, 'using default 5000');
    flatSpeed = 5000;
  }
  
  // Validate distance and elevation values
  const validDistance = isFinite(distance) ? Math.max(0, distance) : 0;
  const validElevationGain = isFinite(elevationGain) ? Math.max(0, elevationGain) : 0;
  const validElevationLoss = isFinite(elevationLoss) ? Math.max(0, elevationLoss) : 0;
  
  // Convert distance from km to meters
  const distanceMeters = validDistance * 1000;
  
  let totalTime = 0;
  
  // Calculate time for each component: t = d/v
  
  // 1. Flat distance time (horizontal movement)
  const flatDistance = distanceMeters - validElevationGain - validElevationLoss;
  if (flatDistance > 0) {
    const flatTime = flatDistance / flatSpeed; // Time in hours
    totalTime += flatTime;
  }
  
  // 2. Ascent time (vertical movement up)
  if (validElevationGain > 0) {
    const ascentTime = validElevationGain / ascentSpeed; // Time in hours
    totalTime += ascentTime;
  }
  
  // 3. Descent time (vertical movement down)
  if (validElevationLoss > 0) {
    const descentTime = validElevationLoss / descentSpeed; // Time in hours
    totalTime += descentTime;
  }
  
  // Convert from hours to minutes (no terrain penalty applied here)
  const result = totalTime * 60;
  
  // Final validation
  if (!isFinite(result) || result < 0) {
    console.warn('Invalid time calculation result:', result, 'for inputs:', {
      distance: validDistance,
      elevationGain: validElevationGain,
      elevationLoss: validElevationLoss,
      ascentSpeed,
      descentSpeed,
      flatSpeed
    });
    return 0; // Return 0 minutes instead of NaN
  }
  
  return result;
}

/**
 * Find the closest point on a track to a given waypoint
 * @param {Object} waypoint - Waypoint with lat/lon
 * @param {Array} trackPoints - Array of track points
 * @param {number} maxDistance - Maximum distance in meters to consider "close"
 * @returns {Object|null} Closest track point and distance, or null if too far
 */
function findClosestTrackPoint(waypoint, trackPoints, maxDistance = 100) {
  let closestPoint = null;
  let closestDistance = Infinity;
  let closestIndex = -1;
  
  trackPoints.forEach((trackPoint, index) => {
    const distance = calculateDistance(
      waypoint.latitude,
      waypoint.longitude,
      trackPoint.latitude,
      trackPoint.longitude
    ) * 1000; // Convert to meters
    
    if (distance < closestDistance && distance <= maxDistance) {
      closestDistance = distance;
      closestPoint = trackPoint;
      closestIndex = index;
    }
  });
  
  return closestPoint ? { point: closestPoint, distance: closestDistance, index: closestIndex } : null;
}

/**
 * Create route segments by splitting track at waypoints
 * @param {Array} trackPoints - All track points
 * @param {Array} waypoints - GPX waypoints
 * @returns {Array} Array of route segments
 */
function createRouteSegments(trackPoints, waypoints) {
  const segments = [];
  let currentSegmentStart = 0;
  
  // Sort waypoints by their position on the track
  const waypointsWithPosition = waypoints.map(waypoint => {
    const closest = findClosestTrackPoint(waypoint, trackPoints, 200); // 200m tolerance
    return {
      ...waypoint,
      trackPosition: closest ? closest.index : -1,
      trackDistance: closest ? closest.distance : Infinity
    };
  }).filter(wp => wp.trackPosition !== -1) // Only keep waypoints that are close to track
   .sort((a, b) => a.trackPosition - b.trackPosition);
  
  // Create segments between waypoints
  waypointsWithPosition.forEach((waypoint, index) => {
    const segmentEnd = waypoint.trackPosition;
    
    if (segmentEnd > currentSegmentStart) {
      segments.push({
        startIndex: currentSegmentStart,
        endIndex: segmentEnd,
        waypoint: waypoint,
        trackPoints: trackPoints.slice(currentSegmentStart, segmentEnd + 1)
      });
      
      currentSegmentStart = segmentEnd;
    }
  });
  
  // Add final segment from last waypoint to end of track
  if (currentSegmentStart < trackPoints.length - 1) {
    segments.push({
      startIndex: currentSegmentStart,
      endIndex: trackPoints.length - 1,
      waypoint: null, // End of route
      trackPoints: trackPoints.slice(currentSegmentStart)
    });
  }
  
  return segments;
}

/**
 * Parse GPX file and extract waypoints with calculations using track-based routing
 * @param {string} gpxContent - GPX file content as string
 * @param {Object} settings - User speed settings including distanceCalculationMethod
 * @returns {Object} Parsed route with waypoints
 */
export function parseGPXFile(gpxContent, settings) {
  try {
    const [parsedGPX, error] = parseGPX(gpxContent);
    
    if (error) {
      throw new Error(`GPX parsing error: ${error}`);
    }
    
    // Extract tracks and waypoints
    const tracks = parsedGPX.tracks || [];
    const gpxWaypoints = parsedGPX.waypoints || [];
    
    if (tracks.length === 0) {
      throw new Error('No tracks found in GPX file');
    }
    
    const track = tracks[0];
    const trackPoints = track.points || [];
    
    if (trackPoints.length === 0) {
      throw new Error('No points found in track');
    }
    
    // Check distance calculation method
    const distanceMethod = settings.distanceCalculationMethod || 'track';
    
    // If using waypoint-to-waypoint method, use simpler calculation
    if (distanceMethod === 'waypoint-to-waypoint') {
      return parseWaypointToWaypoint(gpxWaypoints, trackPoints, settings, track.name);
    }
    
    // Create route segments based on waypoints (track-based method)
    const routeSegments = createRouteSegments(trackPoints, gpxWaypoints);
    
    // If no waypoints are close to the track, use track points as waypoints
    if (routeSegments.length === 0) {
      console.warn('No waypoints found close to track, using track points as waypoints');
      return parseTrackAsWaypoints(trackPoints, settings, track.name);
    }
    
    // Convert segments to waypoints with calculations
    const waypoints = [];
    let totalDistance = 0;
    let totalAscent = 0;
    let totalDescent = 0;
    let totalTime = 0;
    
    // Add start waypoint
    if (trackPoints.length > 0) {
      const startPoint = trackPoints[0];
      waypoints.push({
        id: 'waypoint-start',
        name: 'Start',
        isDecisionPoint: false,
        isStartPoint: true,
        latitude: startPoint.latitude,
        longitude: startPoint.longitude,
        elevation: startPoint.elevation || 0,
        segmentDistance: 0,
        segmentAscent: 0,
        segmentDescent: 0,
        totalDistance: 0,
        totalAscent: 0,
        totalDescent: 0,
        terrainDifficultyPenalty: 0,
        stopDuration: 0,
        segmentTime: 0,
        totalTime: 0,
        timeTillArrival: 0,
        hour: calculateArrivalTime(settings.startTime || '08:00', 0),
        comments: '',
        utm: convertToUTM(startPoint.latitude, startPoint.longitude)
      });
    }
    
    routeSegments.forEach((segment, segmentIndex) => {
      const segmentWaypoints = segment.trackPoints;
      let segmentTotalDistance = 0;
      let segmentTotalAscent = 0;
      let segmentTotalDescent = 0;
      let segmentTotalTime = 0;
      
      // Process each point in the segment
      segmentWaypoints.forEach((point, pointIndex) => {
        let segmentDistance = 0;
        let segmentAscent = 0;
        let segmentDescent = 0;
        let segmentTime = 0;
        
        if (pointIndex > 0) {
          const prevPoint = segmentWaypoints[pointIndex - 1];
          
          // Calculate segment distance
          segmentDistance = calculateDistance(
            prevPoint.latitude,
            prevPoint.longitude,
            point.latitude,
            point.longitude
          );
          
          // Calculate elevation changes
          const elevationChange = (point.elevation || 0) - (prevPoint.elevation || 0);
          if (elevationChange > 0) {
            segmentAscent = elevationChange;
          } else {
            segmentDescent = Math.abs(elevationChange);
          }
          
          // Calculate segment time (pure movement time only)
          segmentTime = calculateSegmentTime(
            segmentDistance,
            segmentAscent,
            segmentDescent,
            settings
          );
          
          segmentTotalDistance += segmentDistance;
          segmentTotalAscent += segmentAscent;
          segmentTotalDescent += segmentDescent;
          segmentTotalTime += segmentTime;
        }
        
        // Only create waypoint for the last point of each segment (the actual waypoint)
        if (pointIndex === segmentWaypoints.length - 1 && segment.waypoint) {
          totalDistance += segmentTotalDistance;
          totalAscent += segmentTotalAscent;
          totalDescent += segmentTotalDescent;
          totalTime += segmentTotalTime;
          
          waypoints.push({
            id: `waypoint-${waypoints.length}`,
            name: segment.waypoint.name || `Waypoint ${waypoints.length + 1}`,
            isDecisionPoint: false,
            latitude: point.latitude,
            longitude: point.longitude,
            elevation: point.elevation || 0,
            segmentDistance: segmentTotalDistance,
            segmentAscent: segmentTotalAscent,
            segmentDescent: segmentTotalDescent,
            totalDistance: totalDistance,
            totalAscent: totalAscent,
            totalDescent: totalDescent,
            terrainDifficultyPenalty: 0,
            stopDuration: 0,
            segmentTime: segmentTotalTime,
            totalTime: totalTime,
            timeTillArrival: totalTime,
            hour: calculateArrivalTime(settings.startTime || '08:00', totalTime),
            comments: segment.waypoint.comment || '',
            utm: convertToUTM(point.latitude, point.longitude)
          });
        }
      });
    });
    
    // Add end waypoint
    if (trackPoints.length > 0) {
      const endPoint = trackPoints[trackPoints.length - 1];
      waypoints.push({
        id: 'waypoint-end',
        name: 'End',
        isDecisionPoint: false,
        isEndPoint: true,
        latitude: endPoint.latitude,
        longitude: endPoint.longitude,
        elevation: endPoint.elevation || 0,
        segmentDistance: 0,
        segmentAscent: 0,
        segmentDescent: 0,
        totalDistance: totalDistance,
        totalAscent: totalAscent,
        totalDescent: totalDescent,
        terrainDifficultyPenalty: 0,
        stopDuration: 0,
        segmentTime: 0,
        totalTime: totalTime,
        timeTillArrival: totalTime,
        hour: calculateArrivalTime(settings.startTime || '08:00', totalTime),
        comments: '',
        utm: convertToUTM(endPoint.latitude, endPoint.longitude)
      });
    }
    
    return {
      gpxData: parsedGPX,
      waypoints: waypoints,
      metadata: {
        name: track.name || 'Unnamed Route',
        totalDistance: totalDistance,
        totalAscent: totalAscent,
        totalDescent: totalDescent,
        maxElevation: calculateMaxElevation(trackPoints)
      }
    };
  } catch (error) {
    console.error('Error parsing GPX file:', error);
    throw error;
  }
}

/**
 * Parse waypoints using waypoint-to-waypoint distance calculation
 * @param {Array} gpxWaypoints - GPX waypoints
 * @param {Array} trackPoints - Track points (for reference)
 * @param {Object} settings - User speed settings
 * @param {string} trackName - Track name
 * @returns {Object} Parsed route with waypoints
 */
function parseWaypointToWaypoint(gpxWaypoints, trackPoints, settings, trackName) {
  if (gpxWaypoints.length === 0) {
    console.warn('No waypoints found, using track points as waypoints');
    return parseTrackAsWaypoints(trackPoints, settings, trackName);
  }
  
  const waypoints = [];
  let totalDistance = 0;
  let totalAscent = 0;
  let totalDescent = 0;
  let totalTime = 0;
  
  // Add start waypoint
  if (trackPoints.length > 0) {
    const startPoint = trackPoints[0];
    waypoints.push({
      id: 'waypoint-start',
      name: 'Start',
      isDecisionPoint: false,
      isStartPoint: true,
      latitude: startPoint.latitude,
      longitude: startPoint.longitude,
      elevation: startPoint.elevation || 0,
      segmentDistance: 0,
      segmentAscent: 0,
      segmentDescent: 0,
      totalDistance: 0,
      totalAscent: 0,
      totalDescent: 0,
      terrainDifficultyPenalty: 0,
      stopDuration: 0,
      segmentTime: 0,
      totalTime: 0,
      timeTillArrival: 0,
      hour: calculateArrivalTime(settings.startTime || '08:00', 0),
      comments: '',
      utm: convertToUTM(startPoint.latitude, startPoint.longitude)
    });
  }
  
  gpxWaypoints.forEach((waypoint, index) => {
    let segmentDistance = 0;
    let segmentAscent = 0;
    let segmentDescent = 0;
    let segmentTime = 0;
    
    if (index > 0) {
      const prevWaypoint = gpxWaypoints[index - 1];
      
      // Calculate straight-line distance between waypoints
      segmentDistance = calculateDistance(
        prevWaypoint.latitude,
        prevWaypoint.longitude,
        waypoint.latitude,
        waypoint.longitude
      );
      
      // Calculate elevation changes
      const elevationChange = (waypoint.elevation || 0) - (prevWaypoint.elevation || 0);
      if (elevationChange > 0) {
        segmentAscent = elevationChange;
      } else {
        segmentDescent = Math.abs(elevationChange);
      }
      
      // Calculate segment time (pure movement time only)
      segmentTime = calculateSegmentTime(
        segmentDistance,
        segmentAscent,
        segmentDescent,
        settings
      );
      
      totalDistance += segmentDistance;
      totalAscent += segmentAscent;
      totalDescent += segmentDescent;
      totalTime += segmentTime;
    }
    
    waypoints.push({
      id: `waypoint-${index}`,
      name: waypoint.name || `Waypoint ${index + 1}`,
      isDecisionPoint: false,
      latitude: waypoint.latitude,
      longitude: waypoint.longitude,
      elevation: waypoint.elevation || 0,
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
      timeTillArrival: totalTime,
      hour: calculateArrivalTime(settings.startTime || '08:00', totalTime),
      comments: waypoint.comment || '',
      utm: convertToUTM(waypoint.latitude, waypoint.longitude)
    });
  });
  
  // Add end waypoint
  if (trackPoints.length > 0) {
    const endPoint = trackPoints[trackPoints.length - 1];
    waypoints.push({
      id: 'waypoint-end',
      name: 'End',
      isDecisionPoint: false,
      isEndPoint: true,
      latitude: endPoint.latitude,
      longitude: endPoint.longitude,
      elevation: endPoint.elevation || 0,
      segmentDistance: 0,
      segmentAscent: 0,
      segmentDescent: 0,
      totalDistance: totalDistance,
      totalAscent: totalAscent,
      totalDescent: totalDescent,
      terrainDifficultyPenalty: 0,
      stopDuration: 0,
      segmentTime: 0,
      totalTime: totalTime,
      timeTillArrival: totalTime,
      hour: calculateArrivalTime(settings.startTime || '08:00', totalTime),
      comments: '',
      utm: convertToUTM(endPoint.latitude, endPoint.longitude)
    });
  }
  
  return {
    gpxData: { tracks: [{ points: trackPoints, name: trackName }], waypoints: gpxWaypoints },
    waypoints: waypoints,
    metadata: {
      name: trackName || 'Unnamed Route',
      totalDistance: totalDistance,
      totalAscent: totalAscent,
      totalDescent: totalDescent,
      maxElevation: calculateMaxElevation(trackPoints)
    }
  };
}

/**
 * Fallback: Parse track points as waypoints when no GPX waypoints are found
 * @param {Array} trackPoints - Track points
 * @param {Object} settings - User speed settings
 * @param {string} trackName - Track name
 * @returns {Object} Parsed route with waypoints
 */
function parseTrackAsWaypoints(trackPoints, settings, trackName) {
  const waypoints = [];
  let totalDistance = 0;
  let totalAscent = 0;
  let totalDescent = 0;
  let totalTime = 0;
  
  // Add start waypoint
  if (trackPoints.length > 0) {
    const startPoint = trackPoints[0];
    waypoints.push({
      id: 'waypoint-start',
      name: 'Start',
      isDecisionPoint: false,
      isStartPoint: true,
      latitude: startPoint.latitude,
      longitude: startPoint.longitude,
      elevation: startPoint.elevation || 0,
      segmentDistance: 0,
      segmentAscent: 0,
      segmentDescent: 0,
      totalDistance: 0,
      totalAscent: 0,
      totalDescent: 0,
      terrainDifficultyPenalty: 0,
      stopDuration: 0,
      segmentTime: 0,
      totalTime: 0,
      timeTillArrival: 0,
      hour: calculateArrivalTime(settings.startTime || '08:00', 0),
      comments: '',
      utm: convertToUTM(startPoint.latitude, startPoint.longitude)
    });
  }
  
  // Sample track points to create reasonable number of waypoints
  const sampleInterval = Math.max(1, Math.floor(trackPoints.length / 20)); // Max 20 waypoints
  
  trackPoints.forEach((point, index) => {
    if (index % sampleInterval === 0 || index === trackPoints.length - 1) {
      let segmentDistance = 0;
      let segmentAscent = 0;
      let segmentDescent = 0;
      let segmentTime = 0;
      
      if (index > 0) {
        const prevPoint = trackPoints[index - 1];
        
        segmentDistance = calculateDistance(
          prevPoint.latitude,
          prevPoint.longitude,
          point.latitude,
          point.longitude
        );
        
        const elevationChange = (point.elevation || 0) - (prevPoint.elevation || 0);
        if (elevationChange > 0) {
          segmentAscent = elevationChange;
        } else {
          segmentDescent = Math.abs(elevationChange);
        }
        
        segmentTime = calculateSegmentTime(
          segmentDistance,
          segmentAscent,
          segmentDescent,
          settings
        );
        
        totalDistance += segmentDistance;
        totalAscent += segmentAscent;
        totalDescent += segmentDescent;
        totalTime += segmentTime;
      }
      
      waypoints.push({
        id: `waypoint-${waypoints.length}`,
        name: point.name || `Point ${waypoints.length + 1}`,
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
        timeTillArrival: totalTime,
        hour: calculateArrivalTime(settings.startTime || '08:00', totalTime),
        comments: '',
        utm: convertToUTM(point.latitude, point.longitude)
      });
    }
    });
    
    // Add end waypoint
    if (trackPoints.length > 0) {
      const endPoint = trackPoints[trackPoints.length - 1];
      waypoints.push({
        id: 'waypoint-end',
        name: 'End',
        isDecisionPoint: false,
        isEndPoint: true,
        latitude: endPoint.latitude,
        longitude: endPoint.longitude,
        elevation: endPoint.elevation || 0,
        segmentDistance: 0,
        segmentAscent: 0,
        segmentDescent: 0,
        totalDistance: totalDistance,
        totalAscent: totalAscent,
        totalDescent: totalDescent,
        terrainDifficultyPenalty: 0,
        stopDuration: 0,
        segmentTime: 0,
        totalTime: totalTime,
        timeTillArrival: totalTime,
        hour: calculateArrivalTime(settings.startTime || '08:00', totalTime),
        comments: '',
        utm: convertToUTM(endPoint.latitude, endPoint.longitude)
      });
    }
    
    return {
    gpxData: { tracks: [{ points: trackPoints, name: trackName }] },
      waypoints: waypoints,
      metadata: {
      name: trackName || 'Unnamed Route',
        totalDistance: totalDistance,
        totalAscent: totalAscent,
        totalDescent: totalDescent,
        maxElevation: calculateMaxElevation(trackPoints)
      }
    };
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
 * Format minutes as hours and minutes
 * @param {number} minutes - Time in minutes
 * @returns {string} Formatted time as "Xh Ym" or "Ym" if less than 1 hour
 */
export function formatTimeHoursMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  } else {
    return `${remainingMinutes}m`;
  }
}

export function formatTimeHoursMinutesForMin(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}min`;
  } else {
    return `${remainingMinutes}min`;
  }
}

/**
 * Format total time with percentage of total route time
 * @param {number} currentTime - Current total time in minutes
 * @param {number} routeTotalTime - Total route time in minutes
 * @returns {string} Formatted time with percentage
 */
export function formatTotalTimeWithPercentage(currentTime, routeTotalTime) {
  const formattedTime = formatTimeHoursMinutes(currentTime);
  const percentage = routeTotalTime > 0 ? Math.round((currentTime / routeTotalTime) * 100) : 0;
  return `${formattedTime} (${percentage}%)`;
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
      // Recalculate segment time (pure movement time only)
      segmentTime = calculateSegmentTime(
        waypoint.segmentDistance,
        waypoint.segmentAscent,
        waypoint.segmentDescent,
        settings
      );
      
      // Apply terrain penalty and rest time to total time only
      const segmentWithAdaptations = segmentTime * (1 + waypoint.terrainDifficultyPenalty) + waypoint.stopDuration;
      totalTime += segmentWithAdaptations;
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

