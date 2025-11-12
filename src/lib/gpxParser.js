/**
 * GPX Parser - Parses GPX files and extracts waypoints with geometric metrics only
 * Time calculations are handled separately in timeCalculator.js
 */

import { parseGPX } from '@we-gold/gpxjs';

/**
 * Distance constants for GPX parsing and waypoint matching
 * All distances are in meters
 */

// Unified distance threshold for waypoint proximity matching
// Used for: coordinate matching (determining if two coordinates represent the same point),
// finding closest track points, matching waypoints to tracks, and duplicate detection
// Two waypoints/coordinates within this distance are considered the same or related point
const PROXIMITY_THRESHOLD = 10; // meters

// High-precision tolerance for checking if start/end points exactly match track points
const TRACK_POINT_PRECISION_TOLERANCE = 0.1; // meters (100mm)

// Maximum number of waypoints to sample when no GPX waypoints exist
const MAX_SAMPLED_WAYPOINTS = 20;

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
 * Check if two coordinates are close within tolerance
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @param {number} toleranceMeters - Tolerance in meters (default: PROXIMITY_THRESHOLD)
 * @returns {boolean} True if coordinates are within tolerance
 */
function coordinatesAreClose(lat1, lon1, lat2, lon2, toleranceMeters = PROXIMITY_THRESHOLD) {
  if (
    !isFinite(lat1) ||
    !isFinite(lon1) ||
    !isFinite(lat2) ||
    !isFinite(lon2)
  ) {
    return false;
  }

  const distanceKm = calculateDistance(lat1, lon1, lat2, lon2);
  return distanceKm * 1000 <= toleranceMeters;
}

/**
 * Find nearest track point index to given coordinates
 * @param {Array} trackPoints - Array of track points
 * @param {number} latitude - Target latitude
 * @param {number} longitude - Target longitude
 * @returns {number|null} Index of nearest track point or null
 */
function findNearestTrackPointIndex(trackPoints, latitude, longitude) {
  if (!Array.isArray(trackPoints) || trackPoints.length === 0) {
    return null;
  }

  let bestIndex = null;
  let bestDistance = Infinity;

  trackPoints.forEach((trackPoint, index) => {
    if (
      !isFinite(trackPoint?.latitude) ||
      !isFinite(trackPoint?.longitude)
    ) {
      return;
    }

    const distance = calculateDistance(
      latitude,
      longitude,
      trackPoint.latitude,
      trackPoint.longitude
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

/**
 * Calculate metrics for a segment along the track
 * @param {Array} trackPoints - All track points
 * @param {number} startLatitude - Start latitude
 * @param {number} startLongitude - Start longitude
 * @param {number} endLatitude - End latitude
 * @param {number} endLongitude - End longitude
 * @returns {Object} Metrics with distance, ascent, descent
 */
function calculateTrackSegmentMetrics(trackPoints, startLatitude, startLongitude, endLatitude, endLongitude) {
  const fallback = () => ({
    distance: calculateDistance(startLatitude, startLongitude, endLatitude, endLongitude),
    ascent: 0,
    descent: 0
  });

  if (
    !Array.isArray(trackPoints) ||
    trackPoints.length === 0 ||
    !isFinite(startLatitude) ||
    !isFinite(startLongitude) ||
    !isFinite(endLatitude) ||
    !isFinite(endLongitude)
  ) {
    return fallback();
  }

  const startIndex = findNearestTrackPointIndex(trackPoints, startLatitude, startLongitude);
  const endIndex = findNearestTrackPointIndex(trackPoints, endLatitude, endLongitude);

  if (startIndex === null || endIndex === null) {
    return fallback();
  }

  const fromIndex = Math.min(startIndex, endIndex);
  const toIndex = Math.max(startIndex, endIndex);

  const slice = trackPoints.slice(fromIndex, toIndex + 1);
  const pathPoints = [...slice];

  const firstSlicePoint = slice[0];
  const lastSlicePoint = slice[slice.length - 1];

  // Add start point if not close to first track point
  if (
    !coordinatesAreClose(
      firstSlicePoint?.latitude,
      firstSlicePoint?.longitude,
      startLatitude,
      startLongitude,
      TRACK_POINT_PRECISION_TOLERANCE
    )
  ) {
    pathPoints.unshift({
      latitude: startLatitude,
      longitude: startLongitude,
      elevation: firstSlicePoint?.elevation ?? null
    });
  }

  // Add end point if not close to last track point
  if (
    !coordinatesAreClose(
      lastSlicePoint?.latitude,
      lastSlicePoint?.longitude,
      endLatitude,
      endLongitude,
      TRACK_POINT_PRECISION_TOLERANCE
    )
  ) {
    pathPoints.push({
      latitude: endLatitude,
      longitude: endLongitude,
      elevation: lastSlicePoint?.elevation ?? null
    });
  }

  let distance = 0;
  let ascent = 0;
  let descent = 0;

  for (let i = 1; i < pathPoints.length; i++) {
    const previousPoint = pathPoints[i - 1];
    const currentPoint = pathPoints[i];

    if (
      !isFinite(previousPoint?.latitude) ||
      !isFinite(previousPoint?.longitude) ||
      !isFinite(currentPoint?.latitude) ||
      !isFinite(currentPoint?.longitude)
    ) {
      continue;
    }

    distance += calculateDistance(
      previousPoint.latitude,
      previousPoint.longitude,
      currentPoint.latitude,
      currentPoint.longitude
    );

    const previousElevation = isFinite(previousPoint?.elevation) ? previousPoint.elevation : null;
    const currentElevation = isFinite(currentPoint?.elevation) ? currentPoint.elevation : null;

    if (previousElevation != null && currentElevation != null) {
      const elevationChange = currentElevation - previousElevation;
      if (elevationChange > 0) {
        ascent += elevationChange;
      } else if (elevationChange < 0) {
        descent += Math.abs(elevationChange);
      }
    }
  }

  return {
    distance,
    ascent,
    descent
  };
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
 * Add track and direct metrics to waypoints
 * Track metrics follow the actual track, direct metrics are straight-line between waypoints
 * @param {Array} waypoints - Array of waypoints
 * @returns {Array} Waypoints with track and direct metrics added
 */
function addTrackAndDirectMetrics(waypoints) {
  if (!Array.isArray(waypoints)) {
    return [];
  }

  return waypoints.map((waypoint, index) => {
    const previous = index > 0 ? waypoints[index - 1] : null;
    const segmentDistance = waypoint.segmentDistance ?? 0;
    const segmentAscent = waypoint.segmentAscent ?? 0;
    const segmentDescent = waypoint.segmentDescent ?? 0;

    // Direct metrics (straight-line between waypoints)
    let directDistance = 0;
    let directAscent = 0;
    let directDescent = 0;

    if (
      previous &&
      isFinite(previous.latitude) &&
      isFinite(previous.longitude) &&
      isFinite(waypoint.latitude) &&
      isFinite(waypoint.longitude)
    ) {
      directDistance = calculateDistance(
        previous.latitude,
        previous.longitude,
        waypoint.latitude,
        waypoint.longitude
      );

      const elevationDiff = (waypoint.elevation ?? 0) - (previous.elevation ?? 0);
      if (elevationDiff > 0) {
        directAscent = elevationDiff;
      } else if (elevationDiff < 0) {
        directDescent = Math.abs(elevationDiff);
      }
    }

    return {
      ...waypoint,
      // Track metrics (following the track)
      lastWaypointTrackDistance: index === 0 ? 0 : segmentDistance,
      lastWaypointTrackAscent: index === 0 ? 0 : segmentAscent,
      lastWaypointTrackDescent: index === 0 ? 0 : segmentDescent,
      // Direct metrics (waypoint to waypoint)
      lastWaypointDirectDistance: index === 0 ? 0 : directDistance,
      lastWaypointDirectAscent: index === 0 ? 0 : directAscent,
      lastWaypointDirectDescent: index === 0 ? 0 : directDescent
    };
  });
}

/**
 * Update final waypoint metrics for the last segment
 * @param {Array} waypoints - Array of waypoints
 * @param {Array} trackPoints - All track points
 * @returns {Object} Updated waypoints and totals
 */
function updateFinalWaypointMetrics(waypoints, trackPoints) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return { waypoints, totals: null };
  }

  const lastIndex = waypoints.length - 1;
  const lastWaypoint = waypoints[lastIndex];

  if (!lastWaypoint?.isEndPoint) {
    return { waypoints, totals: null };
  }

  const previousWaypoint = waypoints[lastIndex - 1];

  if (
    !isFinite(previousWaypoint?.latitude) ||
    !isFinite(previousWaypoint?.longitude) ||
    !isFinite(lastWaypoint?.latitude) ||
    !isFinite(lastWaypoint?.longitude)
  ) {
    return { waypoints, totals: null };
  }

  const metrics = calculateTrackSegmentMetrics(
    trackPoints,
    previousWaypoint.latitude,
    previousWaypoint.longitude,
    lastWaypoint.latitude,
    lastWaypoint.longitude
  );

  const previousTotals = {
    totalDistance: previousWaypoint.totalDistance ?? 0,
    totalAscent: previousWaypoint.totalAscent ?? 0,
    totalDescent: previousWaypoint.totalDescent ?? 0
  };

  // If metrics are zero, remove the duplicate end waypoint
  if (
    metrics.distance <= 0 &&
    metrics.ascent <= 0 &&
    metrics.descent <= 0
  ) {
    const trimmedWaypoints = waypoints.slice(0, -1);
    if (trimmedWaypoints.length > 0) {
      const updatedPrevious = {
        ...previousWaypoint,
        isEndPoint: true
      };
      trimmedWaypoints[trimmedWaypoints.length - 1] = updatedPrevious;
    }
    return { waypoints: trimmedWaypoints, totals: previousTotals };
  }

  const updatedTotals = {
    totalDistance: previousTotals.totalDistance + metrics.distance,
    totalAscent: previousTotals.totalAscent + metrics.ascent,
    totalDescent: previousTotals.totalDescent + metrics.descent
  };

  waypoints[lastIndex] = {
    ...lastWaypoint,
    segmentDistance: metrics.distance,
    segmentAscent: metrics.ascent,
    segmentDescent: metrics.descent,
    totalDistance: updatedTotals.totalDistance,
    totalAscent: updatedTotals.totalAscent,
    totalDescent: updatedTotals.totalDescent
  };

  return { waypoints, totals: updatedTotals };
}

/**
 * Find the closest point on a track to a given waypoint
 * @param {Object} waypoint - Waypoint with lat/lon
 * @param {Array} trackPoints - Array of track points
 * @param {number} maxDistance - Maximum distance in meters to consider "close" (optional, no limit if not provided)
 * @returns {Object|null} Closest track point and distance, or null if too far (or no track points)
 */
function findClosestTrackPoint(waypoint, trackPoints, maxDistance = null) {
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
    
    if (distance < closestDistance && (maxDistance === null || distance <= maxDistance)) {
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
  // Find closest track point for each waypoint (no distance limit - waypoints may be far from track)
  const waypointsWithPosition = waypoints.map(waypoint => {
    const closest = findClosestTrackPoint(waypoint, trackPoints); // No max distance - find absolute closest
    return {
      ...waypoint,
      trackPosition: closest ? closest.index : -1,
      trackDistance: closest ? closest.distance : Infinity
    };
  }).filter(wp => wp.trackPosition !== -1) // Only keep waypoints that have a closest track point
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
 * Parse GPX file and extract waypoints with geometric metrics only (no time calculations)
 * @param {string} gpxContent - GPX file content as string
 * @param {Object} settings - User settings including distanceCalculationMethod
 * @returns {Object} Parsed route with waypoints containing geometric metrics
 */
/**
 * Create a log entry with timestamp
 * @param {string} type - Log type: 'info', 'warning', 'error'
 * @param {string} message - Log message
 * @param {Object} data - Optional additional data
 * @returns {Object} Log entry
 */
function createLogEntry(type, message, data = {}) {
  return {
    timestamp: new Date().toISOString(),
    type,
    message,
    ...data
  };
}

export function parseGPXGeometry(gpxContent, settings) {
  const log = [];
  try {
    const [parsedGPX, error] = parseGPX(gpxContent);
    
    if (error) {
      throw new Error(`GPX parsing error: ${error}`);
    }
    
    // Extract tracks and waypoints
    const tracks = parsedGPX.tracks || [];
    let gpxWaypoints = Array.isArray(parsedGPX.waypoints) ? [...parsedGPX.waypoints] : [];
    
    if (tracks.length === 0) {
      throw new Error('No tracks found in GPX file');
    }
    
    const track = tracks[0];
    const trackPoints = track.points || [];
    
    if (trackPoints.length === 0) {
      throw new Error('No points found in track');
    }
    
    console.log('[GPX Parser] Tracks:', tracks.length);
    console.log('[GPX Parser] Waypoints from parser:', gpxWaypoints.length);
    console.log('[GPX Parser] Track points:', trackPoints.length);
    
    // Add import log entry
    log.push(createLogEntry('info', 'GPX file imported', {
      trackCount: tracks.length,
      waypointCount: gpxWaypoints.length,
      trackPointCount: trackPoints.length,
      trackName: track.name || 'Unnamed Route'
    }));
    
    // Check if no waypoints detected
    if (gpxWaypoints.length === 0) {
      log.push(createLogEntry('warning', 'No waypoints detected in GPX file', {
        fallback: 'Using track points as waypoints'
      }));
    } else {
      log.push(createLogEntry('info', `${gpxWaypoints.length} waypoint(s) detected in GPX file`));
    }
    
    // Check distance calculation method
    const distanceMethod = settings?.distanceCalculationMethod || 'track';
    
    // If using waypoint-to-waypoint method, use simpler calculation
    if (distanceMethod === 'waypoint-to-waypoint') {
      return parseWaypointToWaypoint(gpxWaypoints, trackPoints, settings, track.name, log);
    }
    
    // Create route segments based on waypoints (track-based method)
    const routeSegments = createRouteSegments(trackPoints, gpxWaypoints);
    
    // If no waypoints are close to the track, use track points as waypoints
    if (routeSegments.length === 0) {
      console.warn('No waypoints found close to track, using track points as waypoints');
      log.push(createLogEntry('warning', 'No waypoints found close to track', {
        action: 'Using track points as waypoints'
      }));
      return parseTrackAsWaypoints(trackPoints, settings, track.name, log);
    }
    
    // Convert segments to waypoints with geometric calculations only
    const waypoints = [];
    let totalDistance = 0;
    let totalAscent = 0;
    let totalDescent = 0;
    
    // Add start waypoint
    if (trackPoints.length > 0) {
      const startPoint = trackPoints[0];
      const matchingStart = gpxWaypoints.find(wp =>
        coordinatesAreClose(wp.latitude, wp.longitude, startPoint.latitude, startPoint.longitude)
      );

      waypoints.push({
        id: 'waypoint-start',
        name: matchingStart?.name || matchingStart?.comment || 'Start',
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
        comments: matchingStart?.comment || '',
        utm: convertToUTM(startPoint.latitude, startPoint.longitude)
      });
    }
    
    routeSegments.forEach((segment) => {
      if (!segment?.waypoint || !Array.isArray(segment.trackPoints) || segment.trackPoints.length === 0) {
        return;
      }

      const targetPoint = segment.trackPoints[segment.trackPoints.length - 1];
      const previousWaypoint = waypoints[waypoints.length - 1];

      if (!previousWaypoint) {
        return;
      }

      // Calculate track-based metrics (following the actual track)
      const trackMetrics = calculateTrackSegmentMetrics(
        trackPoints,
        previousWaypoint.latitude,
        previousWaypoint.longitude,
        targetPoint.latitude,
        targetPoint.longitude
      );

      // Calculate direct metrics (straight-line distance)
      const directDistance = calculateDistance(
        previousWaypoint.latitude,
        previousWaypoint.longitude,
        targetPoint.latitude,
        targetPoint.longitude
      );

      const elevationDiff = (targetPoint.elevation ?? 0) - (previousWaypoint.elevation ?? 0);
      const directAscent = elevationDiff > 0 ? elevationDiff : 0;
      const directDescent = elevationDiff < 0 ? Math.abs(elevationDiff) : 0;

      totalDistance += trackMetrics.distance;
      totalAscent += trackMetrics.ascent;
      totalDescent += trackMetrics.descent;

      waypoints.push({
        id: `waypoint-${waypoints.length}`,
        name: segment.waypoint.name || `Waypoint ${waypoints.length + 1}`,
        isDecisionPoint: false,
        latitude: targetPoint.latitude,
        longitude: targetPoint.longitude,
        elevation: targetPoint.elevation || 0,
        segmentDistance: trackMetrics.distance,
        segmentAscent: trackMetrics.ascent,
        segmentDescent: trackMetrics.descent,
        totalDistance: totalDistance,
        totalAscent: totalAscent,
        totalDescent: totalDescent,
        terrainDifficultyPenalty: segment.waypoint.terrainDifficultyPenalty || 0,
        stopDuration: segment.waypoint.stopDuration || 0,
        lastWaypointTrackDistance: trackMetrics.distance,
        lastWaypointTrackAscent: trackMetrics.ascent,
        lastWaypointTrackDescent: trackMetrics.descent,
        lastWaypointDirectDistance: directDistance,
        lastWaypointDirectAscent: directAscent,
        lastWaypointDirectDescent: directDescent,
        comments: segment.waypoint.comment || '',
        utm: convertToUTM(targetPoint.latitude, targetPoint.longitude)
      });
    });
    
    // Add end waypoint
    if (trackPoints.length > 0) {
      const endPoint = trackPoints[trackPoints.length - 1];
      const matchingEnd = gpxWaypoints.find(wp =>
        coordinatesAreClose(wp.latitude, wp.longitude, endPoint.latitude, endPoint.longitude)
      );

      // Check if last waypoint is already at the end
      const lastWaypoint = waypoints[waypoints.length - 1];
      const isLastAtEnd = lastWaypoint && coordinatesAreClose(
        lastWaypoint.latitude,
        lastWaypoint.longitude,
        endPoint.latitude,
        endPoint.longitude
      );

      if (!isLastAtEnd) {
        const endMetrics = lastWaypoint
          ? calculateTrackSegmentMetrics(
              trackPoints,
              lastWaypoint.latitude,
              lastWaypoint.longitude,
              endPoint.latitude,
              endPoint.longitude
            )
          : { distance: 0, ascent: 0, descent: 0 };

        totalDistance += endMetrics.distance;
        totalAscent += endMetrics.ascent;
        totalDescent += endMetrics.descent;

        waypoints.push({
          id: 'waypoint-end',
          name: matchingEnd?.name || matchingEnd?.comment || 'End',
          isDecisionPoint: false,
          isEndPoint: true,
          latitude: endPoint.latitude,
          longitude: endPoint.longitude,
          elevation: endPoint.elevation || 0,
          segmentDistance: endMetrics.distance,
          segmentAscent: endMetrics.ascent,
          segmentDescent: endMetrics.descent,
          totalDistance: totalDistance,
          totalAscent: totalAscent,
          totalDescent: totalDescent,
          terrainDifficultyPenalty: 0,
          stopDuration: 0,
          lastWaypointTrackDistance: endMetrics.distance,
          lastWaypointTrackAscent: endMetrics.ascent,
          lastWaypointTrackDescent: endMetrics.descent,
          lastWaypointDirectDistance: lastWaypoint
            ? calculateDistance(lastWaypoint.latitude, lastWaypoint.longitude, endPoint.latitude, endPoint.longitude)
            : 0,
          lastWaypointDirectAscent: lastWaypoint && (endPoint.elevation ?? 0) > (lastWaypoint.elevation ?? 0)
            ? (endPoint.elevation ?? 0) - (lastWaypoint.elevation ?? 0)
            : 0,
          lastWaypointDirectDescent: lastWaypoint && (endPoint.elevation ?? 0) < (lastWaypoint.elevation ?? 0)
            ? (lastWaypoint.elevation ?? 0) - (endPoint.elevation ?? 0)
            : 0,
          comments: matchingEnd?.comment || '',
          utm: convertToUTM(endPoint.latitude, endPoint.longitude)
        });
      } else {
        // Update last waypoint to mark as end
        waypoints[waypoints.length - 1] = {
          ...lastWaypoint,
          isEndPoint: true,
          name: matchingEnd?.name || matchingEnd?.comment || lastWaypoint.name || 'End'
        };
      }
    }
    
    // Update final waypoint metrics and remove duplicates
    const finalUpdate = updateFinalWaypointMetrics(waypoints, trackPoints);
    const waypointsWithMetrics = addTrackAndDirectMetrics(finalUpdate.waypoints);
    
    return {
      gpxData: parsedGPX,
      waypoints: waypointsWithMetrics,
      metadata: {
        name: track.name || 'Unnamed Route',
        totalDistance: finalUpdate.totals?.totalDistance ?? totalDistance,
        totalAscent: finalUpdate.totals?.totalAscent ?? totalAscent,
        totalDescent: finalUpdate.totals?.totalDescent ?? totalDescent,
        maxElevation: calculateMaxElevation(trackPoints)
      },
      log
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
 * @param {Object} settings - User settings
 * @param {string} trackName - Track name
 * @param {Array} log - Log array to append entries to
 * @returns {Object} Parsed route with waypoints
 */
function parseWaypointToWaypoint(gpxWaypoints, trackPoints, settings, trackName, log = []) {
  if (gpxWaypoints.length === 0) {
    console.warn('No waypoints found, using track points as waypoints');
    log.push(createLogEntry('warning', 'No waypoints found', {
      action: 'Using track points as waypoints'
    }));
    return parseTrackAsWaypoints(trackPoints, settings, trackName, log);
  }

  // Sort waypoints by track position
  const sortedWaypoints = [...gpxWaypoints].map(wp => ({
    ...wp,
    trackIndex: findNearestTrackPointIndex(trackPoints, wp.latitude, wp.longitude)
  })).filter(wp => wp.trackIndex !== null)
    .sort((a, b) => a.trackIndex - b.trackIndex);

  // Filter out near-duplicates
  const filteredWaypoints = sortedWaypoints.reduce((acc, waypoint) => {
    if (acc.length === 0) {
      acc.push(waypoint);
      return acc;
    }

    const last = acc[acc.length - 1];
    const distance = calculateDistance(
      last.latitude,
      last.longitude,
      waypoint.latitude,
      waypoint.longitude
    ) * 1000; // Convert to meters

    if (distance >= PROXIMITY_THRESHOLD) {
      acc.push(waypoint);
    }

    return acc;
  }, []);

  if (filteredWaypoints.length === 0) {
    console.warn('Filtered waypoints resulted in empty list, using track points as waypoints');
    log.push(createLogEntry('warning', 'Filtered waypoints resulted in empty list', {
      action: 'Using track points as waypoints'
    }));
    return parseTrackAsWaypoints(trackPoints, settings, trackName, log);
  }

  const waypoints = [];
  let totalDistance = 0;
  let totalAscent = 0;
  let totalDescent = 0;
  
  // Add start waypoint
  if (trackPoints.length > 0) {
    const startPoint = trackPoints[0];
    const matchingStart = filteredWaypoints.find(wp =>
      coordinatesAreClose(wp.latitude, wp.longitude, startPoint.latitude, startPoint.longitude)
    );

    waypoints.push({
      id: 'waypoint-start',
      name: matchingStart?.name || matchingStart?.comment || 'Start',
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
      lastWaypointTrackDistance: 0,
      lastWaypointTrackAscent: 0,
      lastWaypointTrackDescent: 0,
      lastWaypointDirectDistance: 0,
      lastWaypointDirectAscent: 0,
      lastWaypointDirectDescent: 0,
      comments: matchingStart?.comment || '',
      utm: convertToUTM(startPoint.latitude, startPoint.longitude)
    });

    // Remove matching start from filtered waypoints
    if (matchingStart) {
      const startIndex = filteredWaypoints.findIndex(wp =>
        coordinatesAreClose(wp.latitude, wp.longitude, matchingStart.latitude, matchingStart.longitude)
      );
      if (startIndex !== -1) {
        filteredWaypoints.splice(startIndex, 1);
      }
    }
  }
  
  filteredWaypoints.forEach((waypoint) => {
    const referenceWaypoint = waypoints[waypoints.length - 1];

    if (!referenceWaypoint) {
      return;
    }

    // Calculate track-based metrics (following the actual track)
    const trackMetrics = calculateTrackSegmentMetrics(
      trackPoints,
      referenceWaypoint.latitude,
      referenceWaypoint.longitude,
      waypoint.latitude,
      waypoint.longitude
    );

    // Calculate direct metrics (straight-line)
    const directDistance = calculateDistance(
      referenceWaypoint.latitude,
      referenceWaypoint.longitude,
      waypoint.latitude,
      waypoint.longitude
    );

    const elevationDiff = (waypoint.elevation ?? 0) - (referenceWaypoint.elevation ?? 0);
    const directAscent = elevationDiff > 0 ? elevationDiff : 0;
    const directDescent = elevationDiff < 0 ? Math.abs(elevationDiff) : 0;

    totalDistance += trackMetrics.distance;
    totalAscent += trackMetrics.ascent;
    totalDescent += trackMetrics.descent;
    
    waypoints.push({
      id: `waypoint-${waypoints.length}`,
      name: waypoint.name || `Waypoint ${waypoints.length + 1}`,
      isDecisionPoint: false,
      latitude: waypoint.latitude,
      longitude: waypoint.longitude,
      elevation: waypoint.elevation || 0,
      segmentDistance: trackMetrics.distance,
      segmentAscent: trackMetrics.ascent,
      segmentDescent: trackMetrics.descent,
      totalDistance: totalDistance,
      totalAscent: totalAscent,
      totalDescent: totalDescent,
      terrainDifficultyPenalty: waypoint.terrainDifficultyPenalty || 0,
      stopDuration: waypoint.stopDuration || 0,
      lastWaypointTrackDistance: trackMetrics.distance,
      lastWaypointTrackAscent: trackMetrics.ascent,
      lastWaypointTrackDescent: trackMetrics.descent,
      lastWaypointDirectDistance: directDistance,
      lastWaypointDirectAscent: directAscent,
      lastWaypointDirectDescent: directDescent,
      comments: waypoint.comment || '',
      utm: convertToUTM(waypoint.latitude, waypoint.longitude)
    });
  });
  
  // Add end waypoint if not already represented
  if (trackPoints.length > 0) {
    const endPoint = trackPoints[trackPoints.length - 1];
    const matchingEnd = filteredWaypoints.find(wp =>
      coordinatesAreClose(wp.latitude, wp.longitude, endPoint.latitude, endPoint.longitude)
    );

    const lastWaypoint = waypoints[waypoints.length - 1];
    const isLastAtEnd = lastWaypoint && coordinatesAreClose(
      lastWaypoint.latitude,
      lastWaypoint.longitude,
      endPoint.latitude,
      endPoint.longitude
    );

    if (!isLastAtEnd) {
      const endMetrics = calculateTrackSegmentMetrics(
        trackPoints,
        lastWaypoint.latitude,
        lastWaypoint.longitude,
        endPoint.latitude,
        endPoint.longitude
      );

      totalDistance += endMetrics.distance;
      totalAscent += endMetrics.ascent;
      totalDescent += endMetrics.descent;

      const directDistance = calculateDistance(
        lastWaypoint.latitude,
        lastWaypoint.longitude,
        endPoint.latitude,
        endPoint.longitude
      );

      const elevationDiff = (endPoint.elevation ?? 0) - (lastWaypoint.elevation ?? 0);
      const directAscent = elevationDiff > 0 ? elevationDiff : 0;
      const directDescent = elevationDiff < 0 ? Math.abs(elevationDiff) : 0;

      waypoints.push({
        id: 'waypoint-end',
        name: matchingEnd?.name || matchingEnd?.comment || 'End',
        isDecisionPoint: false,
        isEndPoint: true,
        latitude: endPoint.latitude,
        longitude: endPoint.longitude,
        elevation: endPoint.elevation || 0,
        segmentDistance: endMetrics.distance,
        segmentAscent: endMetrics.ascent,
        segmentDescent: endMetrics.descent,
        totalDistance: totalDistance,
        totalAscent: totalAscent,
        totalDescent: totalDescent,
        terrainDifficultyPenalty: 0,
        stopDuration: 0,
        lastWaypointTrackDistance: endMetrics.distance,
        lastWaypointTrackAscent: endMetrics.ascent,
        lastWaypointTrackDescent: endMetrics.descent,
        lastWaypointDirectDistance: directDistance,
        lastWaypointDirectAscent: directAscent,
        lastWaypointDirectDescent: directDescent,
        comments: matchingEnd?.comment || '',
        utm: convertToUTM(endPoint.latitude, endPoint.longitude)
      });
    } else {
      // Update last waypoint to mark as end
      waypoints[waypoints.length - 1] = {
        ...lastWaypoint,
        isEndPoint: true,
        name: matchingEnd?.name || matchingEnd?.comment || lastWaypoint.name || 'End'
      };
    }
  }

  const finalUpdate = updateFinalWaypointMetrics(waypoints, trackPoints);
  const waypointsWithMetrics = addTrackAndDirectMetrics(finalUpdate.waypoints);

  return {
    gpxData: { tracks: [{ points: trackPoints, name: trackName }], waypoints: gpxWaypoints },
    waypoints: waypointsWithMetrics,
    metadata: {
      name: trackName || 'Unnamed Route',
      totalDistance: finalUpdate.totals?.totalDistance ?? totalDistance,
      totalAscent: finalUpdate.totals?.totalAscent ?? totalAscent,
      totalDescent: finalUpdate.totals?.totalDescent ?? totalDescent,
      maxElevation: calculateMaxElevation(trackPoints)
    },
    log
  };
}

/**
 * Fallback: Parse track points as waypoints when no GPX waypoints are found
 * @param {Array} trackPoints - Track points
 * @param {Object} settings - User settings
 * @param {string} trackName - Track name
 * @param {Array} log - Log array to append entries to
 * @returns {Object} Parsed route with waypoints
 */
function parseTrackAsWaypoints(trackPoints, settings, trackName, log = []) {
  const waypoints = [];
  let totalDistance = 0;
  let totalAscent = 0;
  let totalDescent = 0;
  
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
      lastWaypointTrackDistance: 0,
      lastWaypointTrackAscent: 0,
      lastWaypointTrackDescent: 0,
      lastWaypointDirectDistance: 0,
      lastWaypointDirectAscent: 0,
      lastWaypointDirectDescent: 0,
      comments: '',
      utm: convertToUTM(startPoint.latitude, startPoint.longitude)
    });
  }
  
  // Sample track points to create reasonable number of waypoints
  const sampleInterval = Math.max(1, Math.floor(trackPoints.length / MAX_SAMPLED_WAYPOINTS));
  
  trackPoints.forEach((point, index) => {
    // Skip the start point (index 0) as it's already added
    if (index === 0) {
      return;
    }
    
    if (index % sampleInterval === 0 || index === trackPoints.length - 1) {
      const previousWaypoint = waypoints[waypoints.length - 1];
      
      // Calculate track-based metrics from previous waypoint to this point
      let segmentDistance = 0;
      let segmentAscent = 0;
      let segmentDescent = 0;
      
      if (previousWaypoint) {
        const trackMetrics = calculateTrackSegmentMetrics(
          trackPoints,
          previousWaypoint.latitude,
          previousWaypoint.longitude,
          point.latitude,
          point.longitude
        );
        
        segmentDistance = trackMetrics.distance;
        segmentAscent = trackMetrics.ascent;
        segmentDescent = trackMetrics.descent;
        
        totalDistance += segmentDistance;
        totalAscent += segmentAscent;
        totalDescent += segmentDescent;
      }
      
      // Calculate direct metrics (straight-line)
      const directDistance = previousWaypoint
        ? calculateDistance(
            previousWaypoint.latitude,
            previousWaypoint.longitude,
            point.latitude,
            point.longitude
          )
        : 0;

      const elevationDiff = previousWaypoint
        ? (point.elevation ?? 0) - (previousWaypoint.elevation ?? 0)
        : 0;
      const directAscent = elevationDiff > 0 ? elevationDiff : 0;
      const directDescent = elevationDiff < 0 ? Math.abs(elevationDiff) : 0;
      
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
        lastWaypointTrackDistance: segmentDistance,
        lastWaypointTrackAscent: segmentAscent,
        lastWaypointTrackDescent: segmentDescent,
        lastWaypointDirectDistance: directDistance,
        lastWaypointDirectAscent: directAscent,
        lastWaypointDirectDescent: directDescent,
        comments: '',
        utm: convertToUTM(point.latitude, point.longitude)
      });
    }
  });
  
  // Add end waypoint
  if (trackPoints.length > 0) {
    const endPoint = trackPoints[trackPoints.length - 1];
    const lastWaypoint = waypoints[waypoints.length - 1];
    
    // Check if last waypoint is already at the end
    const isLastAtEnd = lastWaypoint && coordinatesAreClose(
      lastWaypoint.latitude,
      lastWaypoint.longitude,
      endPoint.latitude,
      endPoint.longitude
    );

    if (!isLastAtEnd) {
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
        lastWaypointTrackDistance: 0,
        lastWaypointTrackAscent: 0,
        lastWaypointTrackDescent: 0,
        lastWaypointDirectDistance: lastWaypoint
          ? calculateDistance(lastWaypoint.latitude, lastWaypoint.longitude, endPoint.latitude, endPoint.longitude)
          : 0,
        lastWaypointDirectAscent: lastWaypoint && (endPoint.elevation ?? 0) > (lastWaypoint.elevation ?? 0)
          ? (endPoint.elevation ?? 0) - (lastWaypoint.elevation ?? 0)
          : 0,
        lastWaypointDirectDescent: lastWaypoint && (endPoint.elevation ?? 0) < (lastWaypoint.elevation ?? 0)
          ? (lastWaypoint.elevation ?? 0) - (endPoint.elevation ?? 0)
          : 0,
        comments: '',
        utm: convertToUTM(endPoint.latitude, endPoint.longitude)
      });
    } else {
      waypoints[waypoints.length - 1] = {
        ...lastWaypoint,
        isEndPoint: true
      };
    }
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
    },
    log
  };
}

/**
 * Recalculate geometric metrics (distances, ascent/descent totals, UTM) for waypoints
 * @param {Array} waypoints - Array of waypoints with latitude/longitude data
 * @returns {Array} Updated waypoint array with recalculated geometry
 */
export function recalculateWaypointGeometry(waypoints = []) {
  if (!Array.isArray(waypoints) || waypoints.length === 0) {
    return waypoints;
  }

  let totalDistance = 0;
  let totalAscent = 0;
  let totalDescent = 0;

  return waypoints.map((waypoint, index) => {
    const previous = index > 0 ? waypoints[index - 1] : null;

    let segmentDistance = 0;
    let segmentAscent = 0;
    let segmentDescent = 0;

    const currentLat = waypoint?.latitude;
    const currentLon = waypoint?.longitude;
    const previousLat = previous?.latitude;
    const previousLon = previous?.longitude;

    if (
      index > 0 &&
      isFinite(previousLat) &&
      isFinite(previousLon) &&
      isFinite(currentLat) &&
      isFinite(currentLon)
    ) {
      segmentDistance = calculateDistance(previousLat, previousLon, currentLat, currentLon);
    }

    const previousElevation = isFinite(previous?.elevation) ? previous.elevation : null;
    let currentElevation = isFinite(waypoint?.elevation)
      ? waypoint.elevation
      : previousElevation ?? 0;

    if (index > 0 && previousElevation != null && currentElevation != null) {
      const elevationChange = currentElevation - previousElevation;
      if (elevationChange > 0) {
        segmentAscent = elevationChange;
      } else if (elevationChange < 0) {
        segmentDescent = Math.abs(elevationChange);
      }
    }

    totalDistance += segmentDistance;
    totalAscent += segmentAscent;
    totalDescent += segmentDescent;

    return {
      ...waypoint,
      elevation: currentElevation ?? 0,
      segmentDistance,
      segmentAscent,
      segmentDescent,
      totalDistance,
      totalAscent,
      totalDescent,
      utm:
        isFinite(currentLat) && isFinite(currentLon)
          ? convertToUTM(currentLat, currentLon)
          : waypoint.utm ?? ''
    };
  });
}
