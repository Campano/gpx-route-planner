/**
 * PDF Export Service for generating route PDFs
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { translations } from './translations.js';

/**
 * Export route to PDF
 * @param {Object} route - Route object with waypoints
 * @param {Object} settings - User speed settings
 * @param {string} language - Language code for translations
 */
export function exportRouteToPDF(route, settings, language = 'en') {
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

  // Helper function for translations
  const t = (key) => {
    return translations[language]?.[key] || translations.en[key] || key;
  };
  
  // Helper function to get effective settings for a route
  const getEffectiveSettings = (route) => {
    if (route?.settings) {
      return route.settings;
    }
    const currentSpeeds = settings.activityModes[settings.activityMode];
    return {
      ...settings,
      ascentSpeed: currentSpeeds.ascentSpeed,
      descentSpeed: currentSpeeds.descentSpeed,
      flatSpeed: currentSpeeds.flatSpeed,
    };
  };

  // Add title
  doc.setFontSize(18);
  doc.text(route.name || 'Mountain Route Plan', 14, 15);
  
  // Calculate table start position
  let tableStartY = 42; // Default fallback
  
  // Add compact statistics like in the UI
  if (route.waypoints.length > 0) {
    const lastWaypoint = route.waypoints[route.waypoints.length - 1];
    const effectiveSettings = getEffectiveSettings(route);
    const safetyTime = (lastWaypoint.totalTime * (effectiveSettings.safetyTimePercentage / 100));
    const totalWithSafety = lastWaypoint.totalTime + safetyTime;
    
    // Calculate ending time
    const startTime = effectiveSettings.startTime || '08:00';
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const totalMinutes = startHours * 60 + startMinutes + Math.round(totalWithSafety);
    const endingHours = Math.floor(totalMinutes / 60) % 24;
    const endingMinutes = Math.round(totalMinutes % 60);
    const endingTime = `${endingHours.toString().padStart(2, '0')}:${endingMinutes.toString().padStart(2, '0')}`;
    
    // Extract UTM zone
    const utmZones = [...new Set(route.waypoints.map(wp => {
      if (!wp.utm) return null;
      const match = wp.utm.match(/Zone (\d+[A-Z])/);
      return match ? match[1] : null;
    }).filter(Boolean))];
    const utmZone = utmZones.length > 0 ? utmZones.join(', ') : 'N/A';
    
    // Activity mode translation
    const activityMode = effectiveSettings.activityMode || settings.activityMode;
    
    // Helper function to replace arrow characters with ASCII equivalents for PDF compatibility
    const replaceArrowsForPDF = (text) => {
      return text.replace(/↑/g, '^')
                .replace(/↓/g, 'v')
                .replace(/→/g, '>');
    };
    
    // First line: waypoints • distance • ascent • descent • max elevation (using + and - for ascent/descent)
    const firstLineRaw = `${route.waypoints.length} waypoints • ${route.metadata?.totalDistance?.toFixed(2) || lastWaypoint.totalDistance.toFixed(2)} km • +${route.metadata?.totalAscent?.toFixed(0) || lastWaypoint.totalAscent.toFixed(0)}m • -${route.metadata?.totalDescent?.toFixed(0) || lastWaypoint.totalDescent.toFixed(0)}m • ${route.metadata?.maxElevation?.toFixed(0) || '0'}m max`;
    const firstLine = replaceArrowsForPDF(firstLineRaw);
    
    // Second line: duration • start-end time • utm • activity mode (speeds) (using ASCII arrow alternatives)
    const secondLineRaw = `${formatTimeHoursMinutes(totalWithSafety)} • ${startTime}-${endingTime} • ${utmZone} • ${t(activityMode)} (↑${effectiveSettings.ascentSpeed} ↓${effectiveSettings.descentSpeed} →${effectiveSettings.flatSpeed} m/h)`;
    const secondLine = replaceArrowsForPDF(secondLineRaw);
    
    // Set font size to match main table exactly
    doc.setFontSize(7);
    
    // Calculate line positions with proper spacing
    const maxWidth = 250;
    let currentY = 25;
    
    // Render first line with proper width handling
    const firstLineArray = doc.splitTextToSize(firstLine, maxWidth);
    if (Array.isArray(firstLineArray)) {
      firstLineArray.forEach((line, index) => {
        doc.text(line, 14, currentY + (index * 3));
      });
      currentY += firstLineArray.length * 3 + 1;
    } else {
      doc.text(firstLine, 14, currentY);
      currentY += 4;
    }
    
    // Render second line with proper width handling
    const secondLineArray = doc.splitTextToSize(secondLine, maxWidth);
    if (Array.isArray(secondLineArray)) {
      secondLineArray.forEach((line, index) => {
        doc.text(line, 14, currentY + (index * 3));
      });
      currentY += secondLineArray.length * 3 + 1;
    } else {
      doc.text(secondLine, 14, currentY);
      currentY += 4;
    }
    
    const generationDateY = currentY + 2;
    
    // Add generation date below the compact statistics
    doc.setFontSize(8);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, generationDateY);
    
    // Store the table start position for use later
    tableStartY = generationDateY + 6;
  }
  
  // Prepare table data matching the UI structure
  const tableData = route.waypoints.map((wp, index) => {
    // Handle penalty display with time in parentheses when non-null
    const penaltyDisplay = index === 0 
      ? '-' // Empty for first waypoint (using hyphen instead of em-dash)
      : wp.terrainDifficultyPenalty > 0 
        ? `${(wp.terrainDifficultyPenalty * 100).toFixed(0)}% (${formatTimeHoursMinutesForMin(wp.segmentTime * wp.terrainDifficultyPenalty)})`
        : `${(wp.terrainDifficultyPenalty * 100).toFixed(0)}%`;
    
    return [
      wp.isDecisionPoint ? `${wp.name}\n\n/!\\ DECISION POINT /!\\` : wp.name, // Waypoint column with prominent decision point indicator
      `${wp.utm ? wp.utm.replace(/^Zone \d+ /, '') : 'N/A'}\n${wp.elevation.toFixed(0)}m`, // Position column with UTM coordinates and altitude
      // Empty cells for first waypoint's segment columns, data for others
      index === 0 ? '' : `+${wp.segmentAscent.toFixed(0)}m\n-${wp.segmentDescent.toFixed(0)}m\n${wp.segmentDistance.toFixed(2)}km`, // Segment column
      // Route column always shows data
      `+${wp.totalAscent.toFixed(0)}m\n-${wp.totalDescent.toFixed(0)}m\n${wp.totalDistance.toFixed(2)}km`, // Route column
      index === 0 ? '—' : formatTimeHoursMinutesForMin(wp.segmentTime), // Segment time
      penaltyDisplay, // Penalty with time in parentheses if applicable
      index === 0 ? '—' : `${wp.stopDuration.toFixed(0)}m`, // Rest
      formatTimeHoursMinutesForMin(wp.totalTime), // Total time
      `${Math.round((wp.totalTime / route.waypoints[route.waypoints.length - 1].totalTime) * 100)}%`, // Progression
      wp.hour, // Time
      wp.comments || '' // Notes
    ];
  });

  // Add safety time row
  if (route.waypoints.length > 0) {
    const lastWaypoint = route.waypoints[route.waypoints.length - 1];
    const effectiveSettings = getEffectiveSettings(route);
    const safetyTime = (lastWaypoint.totalTime * (effectiveSettings.safetyTimePercentage / 100));
    const totalWithSafety = lastWaypoint.totalTime + safetyTime;
    
    // Calculate arrival time with safety
    const startTime = effectiveSettings.startTime || '08:00';
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const totalMinutes = startHours * 60 + startMinutes + Math.round(totalWithSafety);
    const arrivalHours = Math.floor(totalMinutes / 60) % 24;
    const arrivalMinutes = Math.round(totalMinutes % 60);
    const arrivalTime = `${arrivalHours.toString().padStart(2, '0')}:${arrivalMinutes.toString().padStart(2, '0')}`;
    
    tableData.push([
      `Safety Time (${effectiveSettings.safetyTimePercentage}%)`, // Waypoint with percentage
      '', // Position
      '', // Segment
      '', // Route
      formatTimeHoursMinutesForMin(safetyTime), // Segment time
      '', // Penalty
      '', // Rest
      formatTimeHoursMinutesForMin(totalWithSafety), // Total time
      `100+${effectiveSettings.safetyTimePercentage}%`, // Progression
      arrivalTime, // Time
      '' // Notes
    ]);
  }
  
  // Add table
  autoTable(doc, {
    startY: tableStartY,
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

