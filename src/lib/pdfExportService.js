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
  
  // Add title
  doc.setFontSize(18);
  doc.text(route.name || 'Mountain Route Plan', 14, 15);
  
  // Add metadata
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);
  doc.text(`Start Time: ${settings.startTime}`, 14, 27);
  
  // Add speed settings
  doc.text(`Speed Settings: Ascent ${settings.ascentSpeed} km/h, Descent ${settings.descentSpeed} km/h, Flat ${settings.flatSpeed} km/h`, 14, 32);
  
  // Prepare table data
  const tableData = route.waypoints.map((wp, index) => [
    index + 1,
    wp.name,
    wp.isDecisionPoint ? 'Yes' : 'No',
    wp.elevation.toFixed(0),
    wp.segmentDistance.toFixed(2),
    wp.segmentAscent.toFixed(0),
    wp.segmentDescent.toFixed(0),
    wp.totalDistance.toFixed(2),
    wp.totalAscent.toFixed(0),
    wp.totalDescent.toFixed(0),
    (wp.terrainDifficultyPenalty * 100).toFixed(0) + '%',
    wp.stopDuration.toFixed(0),
    wp.segmentTime.toFixed(0),
    wp.totalTime.toFixed(0),
    wp.hour,
    wp.comments || ''
  ]);
  
  // Add table
  autoTable(doc, {
    startY: 37,
    head: [[
      '#',
      'Name',
      'Decision',
      'Elev (m)',
      'Seg Dist (km)',
      'Seg Asc (m)',
      'Seg Desc (m)',
      'Total Dist (km)',
      'Total Asc (m)',
      'Total Desc (m)',
      'Penalty',
      'Stop (min)',
      'Seg Time (min)',
      'Total Time (min)',
      'Hour',
      'Comments'
    ]],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 25 },
      2: { cellWidth: 12 },
      3: { cellWidth: 12 },
      4: { cellWidth: 15 },
      5: { cellWidth: 14 },
      6: { cellWidth: 14 },
      7: { cellWidth: 16 },
      8: { cellWidth: 14 },
      9: { cellWidth: 15 },
      10: { cellWidth: 12 },
      11: { cellWidth: 13 },
      12: { cellWidth: 16 },
      13: { cellWidth: 17 },
      14: { cellWidth: 12 },
      15: { cellWidth: 'auto' }
    }
  });
  
  // Add summary
  const finalY = doc.lastAutoTable.finalY + 10;
  const lastWaypoint = route.waypoints[route.waypoints.length - 1];
  
  doc.setFontSize(10);
  doc.text('Route Summary:', 14, finalY);
  doc.text(`Total Distance: ${lastWaypoint.totalDistance.toFixed(2)} km`, 14, finalY + 5);
  doc.text(`Total Ascent: ${lastWaypoint.totalAscent.toFixed(0)} m`, 14, finalY + 10);
  doc.text(`Total Descent: ${lastWaypoint.totalDescent.toFixed(0)} m`, 14, finalY + 15);
  doc.text(`Total Time: ${lastWaypoint.totalTime.toFixed(0)} minutes (${(lastWaypoint.totalTime / 60).toFixed(1)} hours)`, 14, finalY + 20);
  doc.text(`Estimated Arrival: ${lastWaypoint.hour}`, 14, finalY + 25);
  
  // Save the PDF
    doc.save(`${route.name || 'route'}.pdf`);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert(`Error exporting PDF: ${error.message}`);
  }
}

