/**
 * Strip elevation band fills from a filled contour_map.svg (lines + fills).
 * Keeps stroke outlines only with a transparent background.
 *
 * For seamless tiling, prefer: node scripts/generate-tileable-contour.mjs
 *
 * Usage: node scripts/strip-contour-fills.mjs [input.svg] [output.svg]
 * Default: public/contour_map.svg -> public/contour_map.svg (+ dark variant)
 */

import { readFileSync, writeFileSync } from 'node:fs'

const inputPath = process.argv[2] ?? 'public/contour_map.svg'
const outputPath = process.argv[3] ?? inputPath

function toLinesOnly(svgText, strokeColor, strokeOpacity, strokeWidth) {
  return svgText
    .replace(/fill="rgb\([^"]+\)"/g, 'fill="none"')
    .replace(
      /stroke="#000" stroke-width="0\.5" stroke-opacity="0\.2"/g,
      `stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-opacity="${strokeOpacity}"`,
    )
    .replace(
      /<svg([^>]*)>/,
      '<svg$1 fill="none">\n  <!-- Lines only: elevation band fills removed -->\n',
    )
}

const source = readFileSync(inputPath, 'utf8')
const light = toLinesOnly(source, '#3f6f52', '0.13', '0.7')
writeFileSync(outputPath, light)

if (!process.argv[3]) {
  const dark = light.replace(
    /stroke="#3f6f52" stroke-width="0\.7" stroke-opacity="0\.13"/g,
    'stroke="#9bc4a8" stroke-width="0.7" stroke-opacity="0.1"',
  )
  writeFileSync('public/contour_map_dark.svg', dark)
}

console.log(`Wrote lines-only contour SVG to ${outputPath}`)
