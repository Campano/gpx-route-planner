import { parseGPX } from '@we-gold/gpxjs';
import fs from 'fs';

const gpxContent = fs.readFileSync('/home/ubuntu/test-route.gpx', 'utf-8');
const [parsedGPX, error] = parseGPX(gpxContent);

if (error) {
  console.error('Error:', error);
} else {
  console.log('Parsed successfully!');
  console.log('Keys:', Object.keys(parsedGPX));
  console.log('Tracks:', parsedGPX.tracks);
  console.log('Waypoints:', parsedGPX.waypoints);
  console.log('Routes:', parsedGPX.routes);
}
