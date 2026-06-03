/**
 * PDF Export Service for generating route PDFs
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { translations } from './translations.js';
import { getLegDescription } from './waypointUtils.js';
import { DEFAULT_ACTIVITY_MODE, getColumnVisibility, getEffectiveRouteSettings } from './routeDefaults.js';
import {
  buildRouteTableRows,
  getRestLabel,
  getRouteEndTime,
  getRowProgressionPercent,
  getRowTimingMinutes,
} from './routeTableRows.js';

/** Unicode arrows often fail in jsPDF's default font; use ASCII dash + greater-than instead. */
const replaceArrowsForPDF = (text) =>
  text
    .replace(/ → /g, ' -> ')
    .replace(/→/g, '->')
    .replace(/↑/g, '^')
    .replace(/↓/g, 'v');

/**
 * Export route to PDF
 * @param {Object} route - Route object with waypoints
 * @param {string} language - Language code for translations
 */
export function exportRouteToPDF(route, language = 'en') {
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
  
  const getEffectiveSettings = getEffectiveRouteSettings;

  // Add title
  doc.setFontSize(18);
  doc.text(route.name || 'Mountain Route Plan', 14, 15);
  
  // Calculate table start position
  let tableStartY = 42; // Default fallback
  
  // Add compact statistics like in the UI
  if (route.waypoints.length > 0) {
    const lastWaypoint = route.waypoints[route.waypoints.length - 1];
    const effectiveSettings = getEffectiveSettings(route);
    const routeEndTime = getRouteEndTime(route.waypoints);
    const safetyTime = routeEndTime * (effectiveSettings.safetyTimePercentage / 100);
    const totalWithSafety = routeEndTime + safetyTime;
    
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
      const match = wp.utm.match(/Zone (\d+)([A-Z])/);
      return match ? `UTM ${match[1]}${match[2]}` : null;
    }).filter(Boolean))];
    const utmZone = utmZones.length > 0 ? utmZones.join(', ') : 'N/A';
    
    // Activity mode translation
    const activityMode = effectiveSettings.activityMode || DEFAULT_ACTIVITY_MODE;
    
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
  
  const cols = getColumnVisibility(getEffectiveSettings(route));
  const routeEndTime = getRouteEndTime(route.waypoints);

  const tableData = buildRouteTableRows(route.waypoints).map((tableRow) => {
    const isRest = tableRow.rowType === 'rest';
    const wp = tableRow.waypoint;
    const index = tableRow.waypointIndex;
    const rest = tableRow.rest;
    const displayName = replaceArrowsForPDF(
      isRest ? getRestLabel(route, wp, t) : getLegDescription(route, index, t),
    );
    const penaltyDisplay = index === 0
      ? '—'
      : wp.terrainDifficultyPenalty > 0
        ? `${(wp.terrainDifficultyPenalty * 100).toFixed(0)}% (${formatTimeHoursMinutesForMin(wp.segmentTime * wp.terrainDifficultyPenalty)})`
        : `${(wp.terrainDifficultyPenalty * 100).toFixed(0)}%`;

    const row = [
      !isRest && wp.isDecisionPoint ? `${displayName}\n\n/!\\ DECISION POINT /!\\` : displayName,
    ];
    if (cols.destinationCoords) {
      row.push(isRest ? '' : `${wp.utm ? wp.utm.replace(/^Zone \d+[A-Z] /, '') : 'N/A'}\n${wp.elevation.toFixed(0)}m`);
    }
    row.push(
      isRest || index === 0
        ? ''
        : `+${wp.segmentAscent.toFixed(0)}m\n-${wp.segmentDescent.toFixed(0)}m\n${wp.segmentDistance.toFixed(2)}km`,
    );
    if (cols.routeDistance) {
      row.push(
        isRest
          ? ''
          : `+${wp.totalAscent.toFixed(0)}m\n-${wp.totalDescent.toFixed(0)}m\n${wp.totalDistance.toFixed(2)}km`,
      );
    }
    row.push(
      isRest
        ? formatTimeHoursMinutesForMin(rest.durationMinutes)
        : index === 0
          ? '—'
          : formatTimeHoursMinutesForMin(wp.segmentTime),
      isRest ? '' : penaltyDisplay,
    );
    if (cols.totalTime) {
      row.push(formatTimeHoursMinutesForMin(isRest ? rest.totalTime : wp.totalTime));
    }
    if (cols.progression) {
      row.push(
        isRest ? '' : `${getRowProgressionPercent(getRowTimingMinutes(tableRow), routeEndTime)}%`,
      );
    }
    row.push(
      isRest ? rest.departureHour : wp.hour,
      isRest ? '' : wp.comments || '',
    );
    return row;
  });

  if (route.waypoints.length > 0) {
    const effectiveSettings = getEffectiveSettings(route);
    const safetyTime = routeEndTime * (effectiveSettings.safetyTimePercentage / 100);
    const totalWithSafety = routeEndTime + safetyTime;
    const startTime = effectiveSettings.startTime || '08:00';
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const totalMinutes = startHours * 60 + startMinutes + Math.round(totalWithSafety);
    const arrivalHours = Math.floor(totalMinutes / 60) % 24;
    const arrivalMinutes = Math.round(totalMinutes % 60);
    const arrivalTime = `${arrivalHours.toString().padStart(2, '0')}:${arrivalMinutes.toString().padStart(2, '0')}`;

    const safetyRow = [`Safety Time (${effectiveSettings.safetyTimePercentage}%)`];
    if (cols.destinationCoords) safetyRow.push('');
    safetyRow.push('');
    if (cols.routeDistance) safetyRow.push('');
    safetyRow.push(formatTimeHoursMinutesForMin(safetyTime), '');
    if (cols.totalTime) safetyRow.push(formatTimeHoursMinutesForMin(totalWithSafety));
    if (cols.progression) safetyRow.push('');
    safetyRow.push(arrivalTime, '');
    tableData.push(safetyRow);
  }

  const tableHead = [t('originDestination')];
  if (cols.destinationCoords) tableHead.push(t('destinationCoords'));
  tableHead.push('Segment');
  if (cols.routeDistance) tableHead.push(t('routeDistance'));
  tableHead.push('Segment', 'Penalty (%)');
  if (cols.totalTime) tableHead.push(t('totalTiming'));
  if (cols.progression) tableHead.push(t('progression'));
  tableHead.push('Time', 'Notes');

  const columnStyles = {};
  let colIndex = 0;
  columnStyles[colIndex++] = { cellWidth: 20, halign: 'center' };
  if (cols.destinationCoords) columnStyles[colIndex++] = { cellWidth: 25, halign: 'center' };
  columnStyles[colIndex++] = { cellWidth: 20, halign: 'center' };
  if (cols.routeDistance) columnStyles[colIndex++] = { cellWidth: 20, halign: 'center' };
  columnStyles[colIndex++] = { cellWidth: 18, halign: 'center' };
  columnStyles[colIndex++] = { cellWidth: 15, halign: 'center' };
  if (cols.totalTime) columnStyles[colIndex++] = { cellWidth: 20, halign: 'center' };
  if (cols.progression) columnStyles[colIndex++] = { cellWidth: 12, halign: 'center' };
  columnStyles[colIndex++] = { cellWidth: 12, halign: 'center' };
  columnStyles[colIndex] = { cellWidth: 'auto', halign: 'left' };

  autoTable(doc, {
    startY: tableStartY,
    head: [tableHead],
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
    columnStyles,
  });
  
  
  // Save the PDF
    doc.save(`${route.name || 'route'}.pdf`);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert(`Error exporting PDF: ${error.message}`);
  }
}

