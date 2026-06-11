/**
 * GPX Export Service for exporting routes to GPX format
 */

import { PROXIMITY_THRESHOLD_M } from './constants.js'

/**
 * Export route to GPX format
 * @param {Object} route - Route object with waypoints and track data
 * @returns {string} GPX XML content
 */
export function exportRouteToGPX(route) {
  if (!route || !route.waypoints || route.waypoints.length === 0) {
    throw new Error('Route has no waypoints to export');
  }

  const trackPoints = route.gpxData?.tracks?.[0]?.points || [];
  const routeName = route.metadata?.name || route.name || 'Exported Route';
  
  // Build waypoints XML
  const waypointsXML = route.waypoints
    .filter(wp => !wp.isStartPoint && !wp.isEndPoint) // Exclude synthetic start/end points
    .map(wp => {
      const name = wp.name || 'Waypoint';
      const ele = wp.elevation != null ? `    <ele>${wp.elevation.toFixed(2)}</ele>\n` : '';
      const cmt = wp.comments ? `    <cmt>${escapeXML(wp.comments)}</cmt>\n` : '';
      const desc = wp.comments ? `    <desc>${escapeXML(wp.comments)}</desc>\n` : '';
      const type = wp.isDecisionPoint ? '    <type>Decision Point</type>\n' : '';
      
      return `  <wpt lat="${wp.latitude.toFixed(6)}" lon="${wp.longitude.toFixed(6)}">\n${ele}    <name>${escapeXML(name)}</name>\n${cmt}${desc}${type}  </wpt>`;
    })
    .join('\n');

  // Build track XML
  const trackPointsXML = trackPoints
    .map(tp => {
      const ele = tp.elevation != null ? `      <ele>${tp.elevation.toFixed(2)}</ele>\n` : '';
      return `      <trkpt lat="${tp.latitude.toFixed(6)}" lon="${tp.longitude.toFixed(6)}">\n${ele}      </trkpt>`;
    })
    .join('\n');

  const trackXML = trackPoints.length > 0
    ? `  <trk>\n    <name>${escapeXML(routeName)}</name>\n    <trkseg>\n${trackPointsXML}\n    </trkseg>\n  </trk>`
    : '';

  // Combine into GPX structure
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Mountain Route Planner" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXML(routeName)}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${waypointsXML ? waypointsXML + '\n' : ''}${trackXML}
</gpx>`;

  return gpx;
}

/**
 * Escape XML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeXML(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000; // Convert to meters
}

/**
 * Check if waypoints have been modified compared to original GPX
 * Uses proximity-based matching (25 metres) to account for waypoints snapped to track points
 * Excludes start/end waypoints that match track start/end from comparison
 * @param {Object} route - Route object
 * @returns {Object} Modification status with details
 */
export function checkWaypointModifications(route) {
  if (!route || !route.gpxData) {
    return { modified: false, added: 0, removed: 0, renamed: 0 };
  }

  const originalWaypoints = route.gpxData.waypoints || [];
  const currentWaypoints = route.waypoints || [];
  const trackPoints = route.gpxData?.tracks?.[0]?.points || [];
  
  // Filter out synthetic start/end points from current waypoints
  const userWaypoints = currentWaypoints.filter(wp => !wp.isStartPoint && !wp.isEndPoint);
  
  // Get start and end track points
  const startTrackPoint = trackPoints.length > 0 ? trackPoints[0] : null;
  const endTrackPoint = trackPoints.length > 0 ? trackPoints[trackPoints.length - 1] : null;
  
  const PROXIMITY_THRESHOLD = PROXIMITY_THRESHOLD_M
  
  // Filter out original waypoints that match start/end track points
  // These are represented as synthetic start/end points, so we exclude them from comparison
  const originalWaypointsToCompare = originalWaypoints.filter(originalWp => {
    if (startTrackPoint) {
      const distanceToStart = calculateDistanceMeters(
        originalWp.latitude,
        originalWp.longitude,
        startTrackPoint.latitude,
        startTrackPoint.longitude
      );
      if (distanceToStart < PROXIMITY_THRESHOLD) {
        return false; // Exclude start waypoint
      }
    }
    
    if (endTrackPoint) {
      const distanceToEnd = calculateDistanceMeters(
        originalWp.latitude,
        originalWp.longitude,
        endTrackPoint.latitude,
        endTrackPoint.longitude
      );
      if (distanceToEnd < PROXIMITY_THRESHOLD) {
        return false; // Exclude end waypoint
      }
    }
    
    return true; // Include this waypoint in comparison
  });
  
  // Track which original waypoints have been matched
  const matchedOriginalIndices = new Set();
  
  // Count modifications
  let added = 0;
  let removed = 0;
  let renamed = 0;
  
  // Match current waypoints to original waypoints by proximity
  userWaypoints.forEach((currentWp) => {
    let bestMatch = null;
    let bestDistance = Infinity;
    let bestOriginalIndex = -1;
    
    // Find closest original waypoint within proximity threshold
    originalWaypointsToCompare.forEach((originalWp, originalIndex) => {
      if (matchedOriginalIndices.has(originalIndex)) {
        return; // Already matched
      }
      
      const distance = calculateDistanceMeters(
        currentWp.latitude,
        currentWp.longitude,
        originalWp.latitude,
        originalWp.longitude
      );
      
      if (distance < PROXIMITY_THRESHOLD && distance < bestDistance) {
        bestDistance = distance;
        bestMatch = originalWp;
        bestOriginalIndex = originalIndex;
      }
    });
    
    if (bestMatch) {
      // Matched to an original waypoint
      matchedOriginalIndices.add(bestOriginalIndex);
      
      // Check if name was changed (excluding auto-generated names)
      const originalName = (bestMatch.name || '').trim();
      const currentName = (currentWp.name || '').trim();
      
      // Only check for rename if names are different
      if (originalName !== currentName) {
        // Check if names are auto-generated patterns
        const isCurrentAutoGenerated = currentName ? /^(Waypoint|Point) \d+$/i.test(currentName) : false;
        const isOriginalAutoGenerated = originalName ? /^(Waypoint|Point) \d+$/i.test(originalName) : false;
        
        // Count as renamed if:
        // 1. Original name exists and is not auto-generated (real name was changed), OR
        // 2. Current name exists and is not auto-generated (user gave it a real name)
        // This captures cases where:
        // - Real name was changed to another real name
        // - Real name was changed to auto-generated (shouldn't happen, but if it does, count it)
        // - Auto-generated name was changed to real name (user named an unnamed waypoint)
        if ((originalName && !isOriginalAutoGenerated) || (currentName && !isCurrentAutoGenerated)) {
          renamed++;
        }
        // Note: If both names are auto-generated or both are empty, we don't count as renamed
        // This avoids false positives when waypoints are auto-generated with sequential names
      }
    } else {
      // No matching original waypoint - this is an added waypoint
      // Check if it's a map-added waypoint (timestamp-based ID pattern)
      const isMapAdded = currentWp.id && 
                        (currentWp.id.startsWith('waypoint-map-') || 
                         (currentWp.id.startsWith('waypoint-') && 
                          currentWp.id !== 'waypoint-start' &&
                          currentWp.id !== 'waypoint-end' &&
                          /^\d+$/.test(currentWp.id.split('-')[1])));
      
      if (isMapAdded) {
        added++;
      } else if (currentWp.id && 
                 currentWp.id !== 'waypoint-start' && 
                 currentWp.id !== 'waypoint-end' &&
                 !currentWp.id.startsWith('waypoint-start') &&
                 !currentWp.id.startsWith('waypoint-end')) {
        // Only count as added if it's not a synthetic waypoint
        added++;
      }
    }
  });
  
  // Check for removed waypoints (original waypoints that weren't matched)
  originalWaypointsToCompare.forEach((originalWp, originalIndex) => {
    if (!matchedOriginalIndices.has(originalIndex)) {
      removed++;
    }
  });

  const modified = added > 0 || removed > 0 || renamed > 0;

  return {
    modified,
    added,
    removed,
    renamed,
    totalOriginal: originalWaypointsToCompare.length,
    totalCurrent: userWaypoints.length
  };
}

