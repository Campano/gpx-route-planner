/**
 * PDF Export Service for generating route PDFs
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Export route to PDF
 * @param {Object} route - Route object with waypoints
 * @param {Object} settings - User speed settings
 */
export function exportRouteToPDF(route, settings) {
  try {
    const doc = new jsPDF('landscape', 'mm', 'a4');
  
  // Helper function to format time in hours and minutes
  const formatTimeHoursMinutes = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  // Helper function to format time in hours and minutes with "min" suffix
  const formatTimeHoursMinutesForMin = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    } else {
      return `${mins}min`;
    }
  };

  // Helper function to format total time with percentage
  const formatTotalTimeWithPercentage = (currentTime, routeTotalTime) => {
    const hours = Math.floor(currentTime / 60);
    const mins = Math.round(currentTime % 60);
    const percentage = routeTotalTime > 0 ? Math.round((currentTime / routeTotalTime) * 100) : 0;
    return `${hours}h ${mins}m (${percentage}%)`;
  };
  
  // Add title and route summary
  doc.setFontSize(18);
  doc.text(route.name || 'Mountain Route Plan', 14, 15);
  
  // Add route summary in top right
  if (route.waypoints.length > 0) {
    const lastWaypoint = route.waypoints[route.waypoints.length - 1];
    const safetyTime = (lastWaypoint.totalTime * (settings.safetyTimePercentage / 100));
    const totalWithSafety = lastWaypoint.totalTime + safetyTime;
    
    doc.setFontSize(10);
    doc.text(`Distance: ${lastWaypoint.totalDistance.toFixed(2)} km`, 150, 15);
    doc.text(`Ascent: ${lastWaypoint.totalAscent.toFixed(0)} m`, 150, 20);
    doc.text(`Descent: ${lastWaypoint.totalDescent.toFixed(0)} m`, 150, 25);
    doc.text(`Max Elevation: ${route.metadata?.maxElevation?.toFixed(0) || '0'} m`, 150, 30);
    doc.text(`Duration: ${formatTimeHoursMinutes(totalWithSafety)}`, 150, 35);
  }
  
  // Add metadata
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);
  doc.text(`Starting Time: ${settings.startTime}`, 14, 27);
  
  // Add ending time next to start time
  if (route.waypoints.length > 0) {
    const lastWaypoint = route.waypoints[route.waypoints.length - 1];
    const safetyTime = (lastWaypoint.totalTime * (settings.safetyTimePercentage / 100));
    const totalWithSafety = lastWaypoint.totalTime + safetyTime;
    
    // Calculate ending time
    const startTime = settings.startTime || '08:00';
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const totalMinutes = startHours * 60 + startMinutes + Math.round(totalWithSafety);
    const endingHours = Math.floor(totalMinutes / 60) % 24;
    const endingMinutes = Math.round(totalMinutes % 60);
    const endingTime = `${endingHours.toString().padStart(2, '0')}:${endingMinutes.toString().padStart(2, '0')}`;
    
    doc.text(`Ending Time: ${endingTime}`, 14, 32);
  }
  
  // Add speed settings
  doc.text(`Speed Settings: Ascent ${settings.ascentSpeed} m/h, Descent ${settings.descentSpeed} m/h, Flat ${settings.flatSpeed} m/h`, 14, 37);
  
  // Add UTM zone if available
  if (route.waypoints.length > 0 && route.waypoints[0].utm) {
    const utmZone = route.waypoints[0].utm.split(' ')[1];
    doc.text(`UTM Zone: ${utmZone}`, 14, 42);
  }
  
  // Prepare table data matching the UI structure
  const tableData = route.waypoints.map((wp) => [
    wp.isDecisionPoint ? `${wp.name}\n\n/!\\ DECISION POINT /!\\` : wp.name, // Waypoint column with prominent decision point indicator
    `${wp.utm ? wp.utm.replace(/^Zone \d+ /, '') : 'N/A'}\n${wp.elevation.toFixed(0)}m`, // Position column with UTM coordinates and altitude
    `+${wp.segmentAscent.toFixed(0)}m\n-${wp.segmentDescent.toFixed(0)}m\n${wp.segmentDistance.toFixed(2)}km`, // Segment column
    `+${wp.totalAscent.toFixed(0)}m\n-${wp.totalDescent.toFixed(0)}m\n${wp.totalDistance.toFixed(2)}km`, // Route column
    formatTimeHoursMinutesForMin(wp.segmentTime), // Segment time
    `${(wp.terrainDifficultyPenalty * 100).toFixed(0)}%`, // Penalty
    `${wp.stopDuration.toFixed(0)}m`, // Rest
    formatTimeHoursMinutesForMin(wp.totalTime), // Total time
    `${Math.round((wp.totalTime / route.waypoints[route.waypoints.length - 1].totalTime) * 100)}%`, // Progression
    wp.hour, // Time
    wp.comments || '' // Notes
  ]);

  // Add safety time row
  if (route.waypoints.length > 0) {
    const lastWaypoint = route.waypoints[route.waypoints.length - 1];
    const safetyTime = (lastWaypoint.totalTime * (settings.safetyTimePercentage / 100));
    const totalWithSafety = lastWaypoint.totalTime + safetyTime;
    
    // Calculate arrival time with safety
    const startTime = settings.startTime || '08:00';
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const totalMinutes = startHours * 60 + startMinutes + Math.round(totalWithSafety);
    const arrivalHours = Math.floor(totalMinutes / 60) % 24;
    const arrivalMinutes = Math.round(totalMinutes % 60);
    const arrivalTime = `${arrivalHours.toString().padStart(2, '0')}:${arrivalMinutes.toString().padStart(2, '0')}`;
    
    tableData.push([
      'Safety Time', // Waypoint
      '', // Position
      '', // Segment
      '', // Route
      formatTimeHoursMinutesForMin(safetyTime), // Segment time
      '', // Penalty
      '', // Rest
      formatTimeHoursMinutesForMin(totalWithSafety), // Total time
      '100%', // Progression
      arrivalTime, // Time
      '' // Notes
    ]);
  }
  
  // Add table
  autoTable(doc, {
    startY: route.waypoints.length > 0 && route.waypoints[0].utm ? 47 : 42,
    head: [[
      'Waypoint',
      'Position',
      'Segment',
      'Route',
      'Segment',
      'Penalty (%)',
      'Rest (min)',
      'Total',
      'Prog.',
      'Time',
      'Notes'
    ]],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      alternateRowStyles: {
        fillColor: [248, 250, 252] // Light gray for alternating rows
      }
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' }, // Waypoint
      1: { cellWidth: 25, halign: 'center' }, // Position (UTM + altitude)
      2: { cellWidth: 20, halign: 'center' }, // Segment
      3: { cellWidth: 20, halign: 'center' }, // Route
      4: { cellWidth: 18, halign: 'center' }, // Segment Time
      5: { cellWidth: 15, halign: 'center' }, // Penalty
      6: { cellWidth: 15, halign: 'center' }, // Rest
      7: { cellWidth: 20, halign: 'center' }, // Total Time
      8: { cellWidth: 12, halign: 'center' }, // Time
      9: { cellWidth: 'auto', halign: 'left' } // Notes
    }
  });
  
  
  // Save the PDF
    doc.save(`${route.name || 'route'}.pdf`);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert(`Error exporting PDF: ${error.message}`);
  }
}

